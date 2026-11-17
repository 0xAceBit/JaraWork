/**
 * Caps the "free work" a payer can ask for. A request whose signed payment verifies but ends in an
 * uncharged non-answer (malformed input, an inconclusive check) costs the server real work and costs the
 * payer nothing. Counting these per payer, after the signature has been verified, means nobody can be
 * framed by a forged payment, and a payer that keeps asking for free work is refused for a while.
 */
export class FreebieLimiter {
  private readonly max: number
  private readonly windowMs: number
  private readonly now: () => number
  private readonly hits = new Map<string, number[]>()

  constructor(max: number, windowMs = 60_000, now: () => number = () => Date.now()) {
    this.max = max
    this.windowMs = windowMs
    this.now = now
  }

  private recent(payer: string): number[] {
    const since = this.now() - this.windowMs
    const kept = (this.hits.get(payer) ?? []).filter((time) => time > since)
    if (kept.length === 0) this.hits.delete(payer)
    else this.hits.set(payer, kept)
    return kept
  }

  /** True if this payer already had its allowance of uncharged answers in the current window. */
  tooMany(payer: string): boolean {
    return this.recent(payer).length >= this.max
  }

  /** Records one uncharged answer. */
  record(payer: string): void {
    if (this.hits.size >= 5000 && !this.hits.has(payer)) this.hits.delete(this.hits.keys().next().value as string)
    this.hits.set(payer, [...this.recent(payer), this.now()])
  }
}
