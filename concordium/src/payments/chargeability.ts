/**
 * Which answers the buyer is charged for. A buyer pays for an ANSWER about the proof. Two kinds of
 * result are not answers, so the payment is cancelled:
 *   - BAD_INPUT: the request itself was malformed; nothing about the proof was examined.
 *   - an inconclusive failure (retryable): a lookup was unavailable, so the check did not finish.
 * A definite fail (bad format, not verifiable, not confirmed) is an answer and is charged.
 */
export function isNonAnswer(verdict: unknown): boolean {
  if (typeof verdict !== 'object' || verdict === null) return false
  const v = verdict as Record<string, unknown>
  if (v.code === 'BAD_INPUT') return true
  return v.verdict === 'fail' && v.retryable === true
}
