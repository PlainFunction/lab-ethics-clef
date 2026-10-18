import { CONCERNS, THEORIES } from './theories'

export const MODEL = '@cf/cloudflare/clef-flash'

/** Workers AI cuts long text input short, so we cap what we send. */
export const MAX_ACTION_CHARS = 1500
export const MAX_CONTEXT_CHARS = 1500

/** Lowest first, as Clef expects for score questions. */
export const STAKES = ['Trivial', 'Minor', 'Serious', 'Grave'] as const

export interface JudgeInput {
  action: string
  context?: string
}

export interface TheoryResult {
  id: string
  name: string
  /** Clef's probability that the theory finds the action permissible, 0 to 1. */
  probability: number
  inVerdict: boolean
}

export type Verdict = 'agreed_ethical' | 'agreed_unethical' | 'contested'

export interface Judgement {
  theories: TheoryResult[]
  /** Over the theories counted in the verdict. */
  mean: number
  min: number
  max: number
  /** max - min. How far apart the theories are. */
  spread: number
  /** How many counted theories put it above 0.5. */
  forCount: number
  verdict: Verdict
  mainConcern: { choice: string; probabilities: Record<string, number> }
  /** Expected stake level: 0 is Trivial, 3 is Grave. */
  stakes: { expected: number; label: string; probabilities: number[] }
}

/** Every counted theory has to clear this for an "agreed" verdict. */
export const AGREE = 0.7

export function validateInput(body: unknown): JudgeInput | string {
  if (!body || typeof body !== 'object') return 'Send a JSON object with an "action" field.'
  const { action, context } = body as Record<string, unknown>
  if (typeof action !== 'string' || action.trim().length < 10) return '"action" must be at least 10 characters.'
  if (action.length > MAX_ACTION_CHARS) return `"action" must be ${MAX_ACTION_CHARS} characters or fewer.`
  if (context !== undefined && typeof context !== 'string') return '"context" must be a string.'
  if (context && context.length > MAX_CONTEXT_CHARS) return `"context" must be ${MAX_CONTEXT_CHARS} characters or fewer.`
  return { action: action.trim(), context: context?.trim() || undefined }
}

export function buildRequest(input: JudgeInput) {
  const state = input.context
    ? `Action: ${input.action}\nContext: ${input.context}`
    : `Action: ${input.action}`

  const questions: Record<string, unknown> = {}
  for (const t of THEORIES) {
    questions[t.id] = {
      type: 'noul',
      instructions: `Judged only by ${t.name}, is this action morally permissible? ${t.test}`,
    }
  }
  questions.main_concern = {
    type: 'choice',
    instructions: 'Which consideration matters most when judging this action?',
    criteria: CONCERNS,
  }
  questions.stakes = {
    type: 'score',
    instructions: 'How much is morally at stake in this action?',
    criteria: [...STAKES],
  }
  return { model: 'clef-flash', state, questions }
}

function probability(answers: Record<string, any>, id: string): number {
  const p = answers?.[id]?.noul
  if (typeof p !== 'number' || p < 0 || p > 1) throw new Error(`Clef gave no probability for "${id}"`)
  return p
}

export function summarise(answers: Record<string, any>): Judgement {
  const theories = THEORIES.map(t => ({ id: t.id, name: t.name, inVerdict: t.inVerdict, probability: probability(answers, t.id) }))
  const counted = theories.filter(t => t.inVerdict).map(t => t.probability)
  const min = Math.min(...counted)
  const max = Math.max(...counted)
  const verdict: Verdict = min >= AGREE ? 'agreed_ethical' : max <= 1 - AGREE ? 'agreed_unethical' : 'contested'

  // We work out the expected level ourselves from the probabilities rather
  // than rely on a summary field, so the maths is the same for every model.
  // Clef keys score probabilities by level index as strings: { "0": 0.08, "1": 0.1, ... }.
  const raw = answers?.stakes?.probabilities
  const stakeProbs = STAKES.map((_, i) => raw?.[String(i)])
  if (!stakeProbs.every(p => typeof p === 'number' && p >= 0 && p <= 1)) {
    throw new Error(`Clef gave no probabilities for "stakes": ${JSON.stringify(answers?.stakes)}`)
  }
  const expected = stakeProbs.reduce((sum, p, i) => sum + p * i, 0)

  const concern = answers?.main_concern
  if (typeof concern?.choice !== 'string') throw new Error('Clef gave no choice for "main_concern"')

  return {
    theories,
    mean: counted.reduce((a, b) => a + b, 0) / counted.length,
    min,
    max,
    spread: max - min,
    forCount: counted.filter(p => p > 0.5).length,
    verdict,
    mainConcern: { choice: concern.choice, probabilities: concern.probabilities ?? {} },
    stakes: { expected, label: STAKES[Math.round(expected)], probabilities: stakeProbs },
  }
}

/** The bit of the AI binding we use, so tests can pass a fake. */
export interface AiLike {
  run(model: string, inputs: unknown, options?: { gateway?: { id: string; collectLog?: boolean } }): Promise<unknown>
}

/** Cloudflare makes an AI Gateway called "default" on the first call through it. */
export const DEFAULT_GATEWAY = 'default'

/** Every call goes through AI Gateway, with the actions people type left out of its logs. */
export async function judge(ai: AiLike, input: JudgeInput, gateway = DEFAULT_GATEWAY): Promise<Judgement> {
  const out = (await ai.run(MODEL, buildRequest(input), { gateway: { id: gateway, collectLog: false } })) as { answers?: Record<string, any> }
  if (!out?.answers) throw new Error('Clef reply had no answers')
  return summarise(out.answers)
}
