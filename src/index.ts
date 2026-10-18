import { judge, validateInput } from './judge'
import { PAGE } from './page'

export interface Env {
  AI: Ai
  /** The AI Gateway calls go through. Unset: "default". */
  AI_GATEWAY_ID?: string
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), { status, headers: { 'content-type': 'application/json' } })

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/' && request.method === 'GET') {
      return new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } })
    }
    if (url.pathname !== '/judge') return json({ error: 'Not found' }, 404)
    if (request.method !== 'POST') return json({ error: 'Use POST' }, 405)

    let body: unknown
    try { body = await request.json() } catch { return json({ error: 'Body must be JSON' }, 400) }

    const input = validateInput(body)
    if (typeof input === 'string') return json({ error: input }, 422)

    try {
      return json(await judge(env.AI, input, env.AI_GATEWAY_ID || undefined))
    } catch (err) {
      console.error(err)
      return json({ error: 'The model call failed' }, 502)
    }
  },
} satisfies ExportedHandler<Env>
