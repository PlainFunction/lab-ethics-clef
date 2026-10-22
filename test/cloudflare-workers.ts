// Plain Node has no cloudflare:workers. Telemetry only needs tracing from it,
// so tests get a span that goes nowhere.
export const tracing = {
  enterSpan<T>(_name: string, fn: (span: { setAttribute(k: string, v: unknown): void; end(): void }) => T): T {
    return fn({ setAttribute() {}, end() {} })
  },
}
