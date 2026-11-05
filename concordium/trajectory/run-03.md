# Run 03: end-to-end design of the Proof Validator

Date: 2026-11-05. Branch: concordium-hackathon. Docs only plus one read-only script. No product code.

## Did

- Checked the owner wallet on testnet with a new read-only script (`scripts/account-info.ts`).
- Read the repo's real proof format and release loop to design against what exists.
- Wrote the design as five documents under `docs/` (01 to 05).

## Verified (ran or read it)

- Wallet `47rTdQXd...VV3pk` exists on testnet with 1 credential, 0 CCD, no tokens, transaction count 1. The one-time faucet request may already be spent.
- Proofs on-chain are a JSON envelope with `type`, `value`, `carrier`, `note` (`src/components/DeliveryModal.tsx`). Non-JSON is treated as text.
- The repo's UI validators are looser than the step-1 validator (http accepted, `Other` carrier accepts anything of 6+ characters, unanchored carrier regexes).
- `processAutoRelease()` releases on a 24-hour timer only. `readOrderFields()` decodes `deliveryProof` and discards it.
- Bun-specific code in `server/agent.ts`: 3 calls (`Bun.file` x2, `Bun.serve` x1) plus one `require()`. The file passes `node --check` on Node 22.23.4. It was not run.

## Assumed (not verified)

- The Nov 22 checkpoint expects a working testnet demo. Requirements not known.
- Roughly 2 to 3 focused hours on build days.
- The registry web app may support testnet registration. Not checked.
- One operator can run both the validator and the facilitator. Seen in a commit message, not in docs.
- Circle wallets SDK and `web-push` run under Node. Not tested.

## Mistake and fix

`docs/design.md` was first written as a single large file and saved truncated (a stub). I found it by reading it back, checked every other file for the truncation marker (none), deleted it, and split the design into five smaller files, each verified after writing.

## Decisions

- Do not port the live agent. One optional, flagged HTTP call is the production hook (doc 03).
- The validator can only accelerate or flag. Any problem falls back to today's timer (doc 02).
- Native CCD is the payment asset. No stablecoin on testnet is required.
- Terminal demo, no UI. Stub store refuses to start if mainnet env names are set.
