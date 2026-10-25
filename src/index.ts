import { Logger, Module, Port, bindTelemetry, traceFetch, type Manifest, type Registry, type TelemetryEnv } from '#capabilities'
import { MODEL, judge, validateInput, type AiLike, type JudgeInput, type Judgement } from './judge'
import { PAGE } from './page'

export interface Env extends TelemetryEnv {
  AI: Ai
  /** The AI Gateway calls go through. Unset: "default". */
  AI_GATEWAY_ID?: string
  /** The spend cap in wrangler.toml. Unbound (in tests), there's no cap. */
  JUDGE_LIMIT?: { limit(options: { key: string }): Promise<{ success: boolean }> }
}

/** One Clef call. A port, so it runs in its own span and the model's time stands out. */
export abstract class Judge extends Port {
  abstract judge(input: JudgeInput): Promise<Judgement>
}

export class ClefJudge extends Judge {
  readonly #ai: AiLike
  readonly #gateway?: string
  constructor(ai: AiLike, gateway?: string) {
    super()
    this.#ai = ai
    this.#gateway = gateway
  }

  async judge(input: JudgeInput) { return judge(this.#ai, input, this.#gateway) }

  describe(): Manifest {
    return { name: `Workers AI ${MODEL}`, use: 'Asks eight ethical theories about one action at once', personalInfo: ['whatever the action describes'], usesAi: true, checkedBy: 'Nobody: it only shows the result', storesIn: 'Nothing (AI Gateway logs are off)' }
  }
}

// Wired in a registry, like every lab: the Judge is traced, and logs go to Loki tied to their trace.
class ClefModule extends Module {
  readonly #env: Env
  constructor(env: Env) {
    super()
    this.#env = env
  }

  register(c: Registry) {
    bindTelemetry(c, this.#env, { serviceName: 'pf-ethics-clef', serviceVersion: '0.0.0', client: 'ethics-clef' })
    c.bind(Judge, () => new ClefJudge(this.#env.AI, this.#env.AI_GATEWAY_ID || undefined))
  }
}

// env is the same object for the life of an isolate, so so is the registry.
const registries = new WeakMap<object, Registry>()
const registryFor = (env: Env) => {
  let c = registries.get(env)
  if (!c) { c = new ClefModule(env).build(); registries.set(env, c) }
  return c
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), { status, headers: { 'content-type': 'application/json' } })

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const c = registryFor(env)
    const route = url.pathname === '/' || url.pathname === '/judge' ? url.pathname : 'unmatched'
    return traceFetch(c, request, ctx, route, async span => {
      if (url.pathname === '/' && request.method === 'GET') {
        return new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } })
      }
      if (url.pathname !== '/judge') return json({ error: 'Not found' }, 404)
      if (request.method !== 'POST') return json({ error: 'Use POST' }, 405)
      // One key for everyone: it caps what we spend, not what one person does.
      if (env.JUDGE_LIMIT && !(await env.JUDGE_LIMIT.limit({ key: 'judge' })).success) {
        return json({ error: 'Nothing was asked: that is the most judgements a minute this Worker takes. Try again in a minute.' }, 429)
      }

      let body: unknown
      try { body = await request.json() } catch { return json({ error: 'Body must be JSON' }, 400) }

      const input = validateInput(body)
      if (typeof input === 'string') return json({ error: input }, 422)

      try {
        const result = await c.get(Judge).judge(input)
        span.setAttribute('pf.verdict', result.verdict)
        return json(result)
      } catch (err) {
        span.recordError(err)
        c.get(Logger).error('judge.failed', { error: err })
        return json({ error: 'The model call failed' }, 502)
      }
    })
  },
} satisfies ExportedHandler<Env>
