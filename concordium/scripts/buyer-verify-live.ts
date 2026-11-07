/**
 * Runs verifyValidator against the REAL testnet registry. Nothing is paid and nothing is sent to a validator.
 * Usage: node scripts/buyer-verify-live.ts [BADGE] [SERVICE_URL]
 */
import { hostedValidatorRegistry } from '../src/buyer/registry.ts'
import { verifyValidator, type VerifyResult } from '../src/buyer/verifyValidator.ts'
import { TESTNET_REGISTRY } from '../src/registry/types.ts'

const OUR_BADGE = 'JyP9YR6Wk3YPaGx3e8zyu'
const OUR_SERVICE = 'https://jarawork-agent.onrender.com/mcp'

async function fetchCard(uri: string): Promise<Uint8Array> {
  if (!uri.startsWith('https://')) throw new Error('only https card URLs are fetched')
  const response = await fetch(uri, { signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error(`card HTTP ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.length > 65536) throw new Error('card is larger than 64 KB')
  return bytes
}

async function check(label: string, badge: string, serviceUrl: string): Promise<void> {
  const result: VerifyResult = await verifyValidator(badge, {
    registry: hostedValidatorRegistry(),
    trustedRegistry: TESTNET_REGISTRY,
    serviceUrl,
    fetchCard,
  })
  if (result.ok) {
    console.log(`${label}\n  VERIFIED  payee ${result.validator.wallet}  endpoint ${result.validator.endpoint}\n`)
  } else {
    console.log(`${label}\n  REFUSED   ${result.code} (step ${result.step}, retryable ${result.retryable})\n  reason: ${result.reason}\n`)
  }
}

const badge = process.argv[2]
const service = process.argv[3]
if (badge !== undefined) {
  await check(`custom: ${badge}`, badge, service ?? OUR_SERVICE)
} else {
  await check('1. OUR validator, calling its real service URL', OUR_BADGE, OUR_SERVICE)
  await check('2. OUR validator, but the buyer is told to call a different service', OUR_BADGE, 'https://evil.example/mcp')
  await check('3. a different real testnet agent (token 0), whose card is not served', 'JyP9TtQC3HCNrTYR3sc2T', OUR_SERVICE)
  await check('4. a badge that is not a token address at all', 'not-a-badge', OUR_SERVICE)
}
