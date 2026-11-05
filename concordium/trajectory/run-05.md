# Run 05: agentWallet and resolvePayee

Date: 2026-11-05. Testnet only. No product change to the live JaraWork app.

## Did
- `src/registry/types.ts`, `hostedReader.ts`, `resolvePayee.ts`: `resolvePayee(tokenAddress)` reads the payee from chain (parse_token_address, get_agent_wallet, and agent_of only to explain a missing wallet).
- `src/registry/agentWalletMessage.ts`: builds the 122-byte setAgentWallet message locally.
- `scripts/registry/08-set-agent-wallet.ts`, `09-resolve-payee.ts`.
- Tests: `test/resolvePayee.test.ts` (12 offline, 2 optional live), `test/agentWalletMessage.test.ts` (2).

## Verified
- 27 tests pass (validator 13, resolvePayee 12, message 2); typecheck and lint clean.
- Live run (`LIVE_REGISTRY=1`): token JyP9TtQC3HCNrTYR3sc2T resolves to the chain wallet even when a card claims another; malformed address is refused as bad input.
- Local 122-byte message equals the hosted service's bytes exactly, and embeds the testnet genesis hash.
- 8 real, recently transferred testnet agents (tokens 277 to 284) have no agentWallet; resolvePayee refuses each with AGENT_WALLET_UNSET.

## Differences from the docs, and findings
1. `get_agent_wallet` returns `{"agent_wallet": null}` for a token that does not exist, not an error. A cleared wallet and a missing agent look identical, so resolvePayee calls `agent_of` to say which.
2. `agent_of` omits the `agent_wallet` key when unset (it is a string when set).
3. `parse_token_address` also returns the registry contract. resolvePayee refuses tokens from any contract other than the trusted registry (12802,0 on testnet); the docs do not mention this risk.
4. Concordium account aliases share their first 29 bytes, so a card claim that differs by alias is still the same account. Handled and tested.

## Assumed / UNVERIFIED
- Which signature the contract verifies for setAgentWallet: raw ed25519 over the 122 bytes, or the SDK `signMessage` format (prepends address + 8 zero bytes). Not in the docs. Script 08 supports both (`--format`); the dry run in 04 decides.
- The "transfer clears agentWallet" tests use a fake registry that changes state. The real chain data above is consistent with it but is not a controlled before/after on one agent.
- Registration of OUR agent is not done yet (0 agents for the owner), so nothing was set on chain.
- By default the registry already sets agentWallet to the owner, so 08 with the default wallet is a no-op unless `--force`.

## Next
- Sign the registration (04 --submit), then 05, 06, 07.
- Decide whether a distinct payee is worth a third account (needs its key as CCD_PAYEE_PRIVATE_KEY).
