/**
 * The buyer's own memory of what it has paid for, so a restart or a repeated sweep cannot pay twice for
 * the same (order reference, proof). With a file it survives restarts; without one it lives in memory.
 *   paid     : a payment went out but no believed answer was recorded yet (a retry may fetch it free)
 *   answered : a believed answer was received; never pay for this request again
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { describeRequest } from '../payments/requestId.ts'

export type PaidState = 'paid' | 'answered'

export function paidKey(orderRef: string, proof: string): string {
  return describeRequest({ proof, orderRef }).requestId
}

export class PaidLog {
  private readonly entries = new Map<string, PaidState>()
  private readonly file: string | null

  constructor(file: string | null = null) {
    this.file = file
    if (file !== null && existsSync(file)) {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (line.trim() === '') continue
        const row = JSON.parse(line) as { key: string; state: PaidState }
        this.entries.set(row.key, row.state)
      }
    }
  }

  get(key: string): PaidState | undefined {
    return this.entries.get(key)
  }

  set(key: string, state: PaidState): void {
    // 'answered' is final; it is never downgraded back to 'paid'.
    if (this.entries.get(key) === 'answered') return
    this.entries.set(key, state)
    if (this.file === null) return
    mkdirSync(dirname(this.file), { recursive: true })
    appendFileSync(this.file, `${JSON.stringify({ key, state })}\n`)
  }
}
