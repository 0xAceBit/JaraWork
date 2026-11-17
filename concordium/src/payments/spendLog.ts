/**
 * The buyer's own record of what it has paid, so its daily spend cap is a rolling 24 hours that survives
 * a restart. A cap held in a variable resets every time the process restarts, which a crash loop or a
 * redeploy would turn into an unlimited budget. With a file the cap holds across restarts; with null it
 * lives in memory only, and the caller has to choose that on purpose.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'

const DAY_MS = 24 * 60 * 60 * 1000

export class SpendLog {
  private readonly file: string | null
  private readonly now: () => number
  private readonly entries: { at: number; amount: bigint }[] = []

  constructor(file: string | null, now: () => number = () => Date.now()) {
    this.file = file
    this.now = now
    if (file !== null && existsSync(file)) {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (line.trim() === '') continue
        const row = JSON.parse(line) as { at: number; amount: string }
        this.entries.push({ at: row.at, amount: BigInt(row.amount) })
      }
    }
  }

  /** Everything paid in the last 24 hours, in microCCD. */
  total24h(): bigint {
    const since = this.now() - DAY_MS
    return this.entries.filter((e) => e.at > since).reduce((sum, e) => sum + e.amount, 0n)
  }

  add(amount: bigint): void {
    const entry = { at: this.now(), amount }
    this.entries.push(entry)
    if (this.file === null) return
    mkdirSync(dirname(this.file), { recursive: true })
    appendFileSync(this.file, `${JSON.stringify({ at: entry.at, amount: amount.toString() })}\n`)
  }
}
