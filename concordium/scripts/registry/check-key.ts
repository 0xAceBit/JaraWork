/**
 * Diagnostic: does the key in concordium/.env belong to the account it should sign for?
 * Prints only public keys and yes/no answers, never the private key.
 *
 * Usage: node scripts/registry/check-key.ts [ENV_VAR_NAME] [ACCOUNT_ADDRESS]
 * Defaults: CCD_OWNER_PRIVATE_KEY and the owner account.
 */
import { ConcordiumGRPCNodeClient, credentials } from '@concordium/web-sdk/nodejs'
import { checkKeyAgainstAccount } from './keycheck.ts'
import { config, requireEnv, show } from './lib.ts'

const envName = process.argv[2] ?? 'CCD_OWNER_PRIVATE_KEY'
const account = process.argv[3] ?? config.owner

const key = requireEnv(envName).trim().replace(/^0x/i, '')
if (!/^[0-9a-fA-F]{64}$/.test(key)) {
  console.error(`${envName} is not 64 hex characters.`)
  process.exit(1)
}

const client = new ConcordiumGRPCNodeClient(config.grpcHost, config.grpcPort, credentials.createSsl(), { timeout: 20_000 })
const check = await checkKeyAgainstAccount(client, account, key)

show('KEY CHECK (public information only)', {
  envVar: envName,
  account,
  onChainPublicKeys: check.onChainKeys,
  publicKeyDerivedFromYourKey: check.derivedPublicKey,
  keyBelongsToThisAccount: check.belongs,
  pastedValueIsActuallyAPublicKey: check.pastedValueIsAPublicKey,
})
process.exit(check.belongs ? 0 : 3)
