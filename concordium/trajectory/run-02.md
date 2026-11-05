# Run 02: environment and integration map

Date: 2026-11-05. Scope: Step A (environment), Step B (docs), Step C (integration map). No product code.

## Did
- Added TypeScript 7.0.2 and `@types/node` 22.20.5 at exact versions, `tsconfig.json` (NodeNext, erasable syntax only), `.nvmrc` and `.node-version` at 22.23.4, `engines.node` `>=22.18.0`.
- Wrote `scripts/latest-block.ts`: one read-only call to Concordium testnet.
- Read the Concordium registry docs, EIP-8004, two Concordium articles, and the official `@x402/concordium` and `@x402/mcp` sources (reference clone of x402-foundation/x402 at `b9cbd85`, kept outside the repo).
- Wrote `docs/integration-map.md` with seven sections and the five riskiest assumptions.

## Verified
- `node scripts/latest-block.ts` returned the latest finalized testnet block (height 50406766, protocol version 10). Output is in the integration map.
- `tsc -p tsconfig.json` exits 0.
- Hosted registry MCP (testnet): 40 tools; CIS-8004 is contract 12802,0 and CIS-8 is 12801,0; 1,008 registered agents; `verify_agent_card` returns `match: false` for a stale card.
- Testnet chain identifier `ccd:4221332d34e1694168c2a0c0b3fd0f27` appears in the x402 spec and matches the first 32 hex characters of the testnet genesis hash fetched by the script.
- `@x402/concordium`, `@x402/mcp` and `@x402/core` (2.30.0) install and import on Node 22.23.4.
- The public facilitator at x402.org does not list Concordium.

## Assumed (not verified)
- Registration, card updates and wallet changes can be signed and submitted from Node using the registry's payload. The exact SDK path is undocumented.
- `@x402/mcp` works with the Concordium scheme and with native CCD.
- Testnet accounts need no lengthy identity onboarding.

## Corrections made during the run
- Moved the reference clone out of the project folder so lint cannot scan it.
- Corrected a claim about the MCP `accept` header: I sent it but did not test without it.
- The x402 spec example and a README show `sponsor.address` and `sponsor.account`; the package source accepts both (`account` is a compatibility alias).

## Next
Resolve risk 1 (payment asset) and risk 2 (transaction submission) before any product code.
