/**
 * Step 9: ask "who may I pay for this agent?" using resolvePayee (reads agentWallet from chain).
 * Exit code 0 = a payee was resolved, 2 = refused (the reason is printed).
 *
 * Usage: node scripts/registry/09-resolve-payee.ts [TOKEN_ADDRESS] [--card-claim ACCOUNT_ADDRESS]
 *   TOKEN_ADDRESS defaults to the token saved by 05-verify.ts.
 *   --card-claim   a wallet the agent card claims; it is compared and reported, never used.
 */
import { resolvePayee } from '../../src/registry/resolvePayee.ts'
import { flagValue, readState, show } from './lib.ts'

const positional = process.argv.slice(2).find((arg, i, all) => !arg.startsWith('--') && all[i - 1] !== '--card-claim')
const tokenAddress = positional ?? readState().tokenAddress
if (!tokenAddress) {
  console.error('Give a token address, or run 05-verify.ts first so one is saved.')
  process.exit(1)
}

const cardClaimedWallet = flagValue('--card-claim')
const result = await resolvePayee(tokenAddress, cardClaimedWallet === undefined ? {} : { cardClaimedWallet })
show(result.ok ? 'PAYEE RESOLVED FROM CHAIN' : 'REFUSED TO PAY', result)
process.exit(result.ok ? 0 : 2)
