import { describe, expect, it, vi } from 'vitest'
import { AGREE, MAX_ACTION_CHARS, MODEL, buildRequest, judge, summarise, validateInput } from '../src/judge'
import { THEORIES } from '../src/theories'
import worker from '../src/index'

/** A Clef-shaped reply where every theory gives the same probability, with overrides. */
function answers(base: number, overrides: Record<string, number> = {}) {
  const a: Record<string, unknown> = {}
  for (const t of THEORIES) a[t.id] = { noul: overrides[t.id] ?? base }
  a.main_concern = { choice: 'harm', probabilities: { harm: 0.6, duty: 0.4 } }
  // The shape Clef-flash really sends for a score question.
  a.stakes = {
    type: 'score',
    score: 1.7,
    legend: { 0: 'Trivial', 1: 'Minor', 2: 'Serious', 3: 'Grave' },
    probabilities: { 0: 0.1, 1: 0.2, 2: 0.6, 3: 0.1 },
    confidence: 0.2,
  }
  return a
}

const fakeAi = (reply: unknown) => ({ run: vi.fn(async () => reply) })

describe('validateInput', () => {
  it('needs an action', () => {
    expect(validateInput({})).toMatch(/action/)
    expect(validateInput({ action: 'short' })).toMatch(/10 characters/)
    expect(validateInput(null)).toMatch(/JSON object/)
  })

  it('caps the length, because Workers AI truncates long input', () => {
    expect(validateInput({ action: 'x'.repeat(MAX_ACTION_CHARS + 1) })).toMatch(/or fewer/)
  })

  it('trims and drops an empty context', () => {
    expect(validateInput({ action: '  Keep a lost wallet  ', context: '  ' })).toEqual({ action: 'Keep a lost wallet', context: undefined })
  })
})

describe('buildRequest', () => {
  it('asks one yes/no question per theory, plus concern and stakes', () => {
    const req = buildRequest({ action: 'Keep a lost wallet' })
    expect(req.model).toBe('clef-flash')
    expect(Object.keys(req.questions)).toEqual([...THEORIES.map(t => t.id), 'main_concern', 'stakes'])
    for (const t of THEORIES) expect(req.questions[t.id]).toMatchObject({ type: 'noul' })
    expect(req.questions.stakes).toMatchObject({ type: 'score', criteria: ['Trivial', 'Minor', 'Serious', 'Grave'] })
  })

  it('stays inside Clef\'s 64-question limit', () => {
    expect(Object.keys(buildRequest({ action: 'Keep a lost wallet' }).questions).length).toBeLessThanOrEqual(64)
  })

  it('puts the context in the state when there is some', () => {
    expect(buildRequest({ action: 'Keep a lost wallet', context: 'It has ID in it' }).state).toBe('Action: Keep a lost wallet\nContext: It has ID in it')
  })
})

describe('summarise', () => {
  it('calls it agreed when every counted theory clears the bar', () => {
    const j = summarise(answers(0.9))
    expect(j.verdict).toBe('agreed_ethical')
    expect(j.forCount).toBe(THEORIES.filter(t => t.inVerdict).length)
  })

  it('calls it agreed unethical when every counted theory is low', () => {
    expect(summarise(answers(0.05)).verdict).toBe('agreed_unethical')
  })

  it('calls it contested when one theory dissents', () => {
    const j = summarise(answers(0.9, { kantian: 0.2 }))
    expect(j.verdict).toBe('contested')
    expect(j.min).toBe(0.2)
    expect(j.spread).toBeCloseTo(0.7)
  })

  it('shows egoism but leaves it out of the verdict', () => {
    const j = summarise(answers(0.9, { egoist: 0.05 }))
    expect(j.verdict).toBe('agreed_ethical')
    expect(j.theories.find(t => t.id === 'egoist')?.probability).toBe(0.05)
  })

  it('treats the bar as inclusive', () => {
    expect(summarise(answers(AGREE)).verdict).toBe('agreed_ethical')
  })

  it('works out the expected stake level from the probabilities', () => {
    const j = summarise(answers(0.5))
    expect(j.stakes.expected).toBeCloseTo(0.2 + 1.2 + 0.3)
    expect(j.stakes.label).toBe('Serious')
  })

  it('fails loudly when a stake level is missing', () => {
    const a = answers(0.5) as Record<string, any>
    delete a.stakes.probabilities[3]
    expect(() => summarise(a)).toThrow(/stakes/)
  })

  it('fails loudly when a probability is missing', () => {
    const a = answers(0.5)
    delete a.virtue
    expect(() => summarise(a)).toThrow(/virtue/)
  })

  it('does not mistake the answer object for the probability', () => {
    const a = answers(0.5)
    a.care = { noul: '0.8' }
    expect(() => summarise(a)).toThrow(/care/)
  })
})

describe('judge', () => {
  it('calls Clef-flash once with every question, through the default AI Gateway with logging off', async () => {
    const ai = fakeAi({ answers: answers(0.8) })
    await judge(ai, { action: 'Keep a lost wallet' })
    expect(ai.run).toHaveBeenCalledTimes(1)
    expect(ai.run).toHaveBeenCalledWith(MODEL, expect.objectContaining({ model: 'clef-flash' }), { gateway: { id: 'default', collectLog: false } })
  })

  it('uses the gateway it is given', async () => {
    const ai = fakeAi({ answers: answers(0.8) })
    await judge(ai, { action: 'Keep a lost wallet' }, 'ethics')
    expect(ai.run).toHaveBeenCalledWith(MODEL, expect.anything(), { gateway: { id: 'ethics', collectLog: false } })
  })
})

describe('worker', () => {
  const env = (reply: unknown) => ({ AI: fakeAi(reply) as unknown as Ai })
  const post = (body: string) => new Request('https://x/judge', { method: 'POST', body })

  it('returns the judgement', async () => {
    const res = await worker.fetch(post(JSON.stringify({ action: 'Return a lost wallet to its owner' })), env({ answers: answers(0.9) }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ verdict: 'agreed_ethical' })
  })

  it('serves the try-it page at /', async () => {
    const res = await worker.fetch(new Request('https://x/'), env({}))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/html/)
    expect(await res.text()).toContain("fetch('/judge'")
  })

  it('rejects bad requests with the right status', async () => {
    expect((await worker.fetch(new Request('https://x/other'), env({}))).status).toBe(404)
    expect((await worker.fetch(new Request('https://x/judge'), env({}))).status).toBe(405)
    expect((await worker.fetch(post('{nope'), env({}))).status).toBe(400)
    expect((await worker.fetch(post('{"action":"hi"}'), env({}))).status).toBe(422)
  })

  it('returns 502 when the model reply is unusable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await worker.fetch(post(JSON.stringify({ action: 'Return a lost wallet' })), env({ nothing: true }))
    expect(res.status).toBe(502)
  })
})

describe('scenarios.json', () => {
  it('has unique ids and only valid inputs', async () => {
    const { default: scenarios } = await import('../scenarios.json')
    expect(new Set(scenarios.map((s: { id: string }) => s.id)).size).toBe(scenarios.length)
    for (const s of scenarios) expect(validateInput(s), s.id).toMatchObject({ action: s.action.trim() })
  })
})
