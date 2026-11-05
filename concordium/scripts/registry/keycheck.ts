/**
 * Does a private key belong to an account? Derives the PUBLIC key from the private key
 * and compares it with the public keys the chain holds for the account.
 * Nothing secret leaves this function: callers get public keys and booleans only.
 */
import * as ed from '@noble/ed25519'
import { AccountAddress } from '@concordium/web-sdk'
import type { ConcordiumGRPCNodeClient } from '@concordium/web-sdk/nodejs'

export interface KeyCheck {
  onChainKeys: string[]
  derivedPublicKey: string
  belongs: boolean
  /** A common slip: the PUBLIC key was copied instead of the private one. */
  pastedValueIsAPublicKey: boolean
}

export async function checkKeyAgainstAccount(
  client: ConcordiumGRPCNodeClient,
  account: string,
  privateKeyHex: string,
): Promise<KeyCheck> {
  const info = await client.getAccountInfo(AccountAddress.fromBase58(account))
  const onChainKeys = Object.values(info.accountCredentials).flatMap((credential) =>
    Object.values(credential.value.contents.credentialPublicKeys.keys).flatMap((k) =>
      k ? [k.verifyKey.toLowerCase()] : [],
    ),
  )
  const derivedPublicKey = Buffer.from(await ed.getPublicKeyAsync(privateKeyHex)).toString('hex')
  return {
    onChainKeys,
    derivedPublicKey,
    belongs: onChainKeys.includes(derivedPublicKey),
    pastedValueIsAPublicKey: onChainKeys.includes(privateKeyHex.toLowerCase()),
  }
}
