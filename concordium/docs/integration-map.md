# Integration map: JaraWork Proof Validator on Concordium (testnet)

Written 2026-11-05. Research only: no product code. Every claim is tagged:

- **[docs]** stated in Concordium or EIP documentation I read
- **[live]** observed by calling a live Concordium endpoint (read-only, no keys)
- **[source]** read in the official x402 repository (commit `b9cbd85`)
- **UNVERIFIED** not shown by any source I read. Do not build on it until confirmed.

## Step A: environment (exact output)

`package.json` already existed from earlier work, so no `npm init` was run (npm is not available in this sandbox). Added TypeScript and `@types/node` at exact versions, a pinned Node version, a `tsconfig.json`, and `scripts/latest-block.ts`.

| Item | Value |
| --- | --- |
| Node pinned | `.nvmrc` and `.node-version` = `22.23.4`; `engines.node` = `>=22.18.0` |
| SDK | `@concordium/web-sdk` `12.0.2` (exact) |
| TypeScript | `7.0.2` (exact), `@types/node` `22.20.5` (exact) |
| Typecheck | `tsc -p tsconfig.json` exit code 0 |

Command `node scripts/latest-block.ts` (Node v24.21.0), unedited output:

```
{
  "endpoint": "grpc.testnet.concordium.com:20000",
  "nodeRuntime": "v24.21.0",
  "lastFinalizedBlockHash": "871b5161127e89b7dbe0468242bbf2c409ee0bebf69b0205706456ac71a086be",
  "lastFinalizedBlockHeight": "50406766",
  "blockSlotTime": "2026-11-05T09:45:39.555Z",
  "protocolVersion": "10",
  "genesisBlockHash": "4221332d34e1694168c2a0c0b3fd0f273809612cb13d000d5c2e00e85f50f796"
}
```

What the SDK needs on Node (observed, not assumed):

- ES modules only (`"type": "module"` in this package), because the SDK is published as ESM.
- The Node gRPC client lives at the subpath `@concordium/web-sdk/nodejs`, not the main entry.
- That client uses `@grpc/grpc-js`, which the SDK already lists as its own dependency. TLS credentials come from `credentials.createSsl()`.
- TypeScript needs `moduleResolution: NodeNext` (or Bundler) so the SDK's `exports` map resolves.
- Peer dependencies `@protobuf-ts/runtime-rpc` and `cbor2` must be present; the package manager installed them.
- The SDK's own `engines` field says Node 16 or later. The WASM bindings load without extra setup.
- Protocol version is 10 on testnet, which is the version that introduced sponsored transactions.

## Step B: what I read, and how much

| Source | Coverage |
| --- | --- |
| agent-registry.concordium.com | Landing page text only (the app itself is wallet-driven) |
| Docs: agent-registry how-to | Excerpt with the full native and Ethereum registration steps |
| Docs: cis-8004, cis-8, agent-card, concordium-badge, mcp-service, x402-integration | Read to the end |
| EIP-8004 | First ~12,000 characters (Identity Registry into the start of Reputation). The Validation Registry section was not read. |
| Article: ERC-8004 explained | First ~12,000 characters (cut off before its final section) |
| Article: Agent identity and trust | Read in full |
| Also read | Sponsored transactions doc, x402 Foundation article, the `@x402/concordium` spec and source, the `@x402/mcp` README |
| Live probes | The hosted registry MCP service: tool list, `contract_info`, `list_agents`, `agent_of`, `get_agent_wallet`, `is_active`, `verify_agent_card`, one `build_register` call (shape only) |

## 1. Registration

**Confirmed**
- Testnet CIS-8004 registry is contract `12802,0` and CIS-8 is `12801,0` [live, `contract_info`]. Mainnet is `10082,0` and `10081,0` [docs].
- Native flow [docs]: build the card, host it, call `build_register` with `agent_uri`, `metadata_hash_hex` and `sender`, sign and submit, receive a `token_id`, then run `verify_agent_card`.
- `build_register` returns a payload with `contract_address`, `receive_name` (`CIS-8004.register`), `parameter_hex`, `parameter_json`, `suggested_energy` (30000) and `sender` [live].
- The testnet registry already holds 1,008 agents [live].
- Registration is a CIS-2 NFT mint to the signing account [docs].

**UNVERIFIED**
- How to turn that payload into a signed, accepted transaction with `@concordium/web-sdk` 12.0.2. No page shows this step.
- Whether the owner account needs a Concordium ID or identity provider setup on testnet before it can register.
- The testnet CCD cost of registering.
- The tool notes the `Cis10` external-reference variant is rejected on live testnet. We would avoid external references.

**First question for the workshop team:** Is there a reference script that signs and submits a `build_register` payload from Node, and what does a testnet owner account need first?

## 2. Card hosting and hash pinning

**Confirmed**
- `agent_uri` is a public URL; `metadata_hash` is the SHA-256 of the raw bytes served there [docs].
- The host must serve exactly the bytes the card builder returned, with no reformatting [docs].
- `build_agent_card` returns canonical JSON plus its SHA-256. Updates use `build_set_agent_uri` [docs].
- `verify_agent_card` returns `match` true, false or null. A live testnet agent whose card URL returns 404 correctly gives `match: false` [live]. So stale or missing cards are detectable by a buyer.
- To avoid a window where the hash and card disagree, host at a new versioned URL and pass `agent_uri` with `metadata_hash_hex` in one transaction [docs].

**UNVERIFIED**
- Whether `ipfs://` or `data:` URIs work for `agent_uri`. ERC-8004 allows them; the Concordium docs say "public URL".
- Size limits for the card or the URI.
- Whether compression, redirects or content type on our host can change the hashed bytes.
- Whether verification tolerates a slow host (see risk 5).

**First question:** Does the verifier require `https` and a path such as `/.well-known/agent-card.json`, and what timeout does `verify_agent_card` use when it fetches the card?

## 3. Badge

**Confirmed**
- The badge string is the Base58Check CIS-2 token address; the canonical form is `ccd:<genesis32>/cis-2:<badge>` [docs].
- Testnet chain identifier is `ccd:4221332d34e1694168c2a0c0b3fd0f27` [source and docs]. It matches the first 32 hex characters of the testnet genesis hash my script fetched [live].
- Embedding: an A2A extension in `capabilities.extensions` under the URI `https://docs.concordium.com/a2a-extensions/concordium-badge/v1` [docs].
- Helpers: `GET /v1/get-badge-JSON/{badge}`, `GET /v1/check-badge/{badge}`, and `build_agent_badge` for merging into an existing card [docs].
- A new agent needs two passes: build the card with a null token address, register, then add the real badge and re-pin [docs].
- Verification checks the contract, `Active` status and that the card hash equals `metadata_hash`. A badge is valid for any contract implementing CIS-8004, so the verifier chooses which registries to trust [docs]. JaraWork's buyer should trust only `12802,0` on testnet.

**UNVERIFIED**
- The exact JSON verdict of `check-badge` on a real card (I have not run it on a registered agent of ours).
- Whether the hackathon accepts a testnet badge as the "Verified by Concordium" requirement.
- Where to obtain the official logomark assets.

**First question:** What does a passing `check-badge` result look like on testnet, and does judging accept testnet registrations?

## 4. agentWallet

**Confirmed**
- `agentWallet` is a reserved metadata key holding the payment wallet [docs]. `get_agent_wallet` returns it, or null when unset [live].
- On a live testnet agent, `agent_wallet` equals the owner account by default [live]. ERC-8004 behaves the same way [EIP].
- Changing it needs two authorisations: the owner signs the transaction, and the new wallet's controller signs a 122-byte canonical message from `set_agent_wallet_canonical_bytes` [docs, tool descriptions].
- Transferring the agent clears it, so a transferred agent returns null until the new owner re-sets it [docs].
- Design rule from your brief: the buyer pays the wallet the registry returns, never an address the card claims.

**UNVERIFIED**
- Whether the payee must be an identity-verified account to receive a PLT token.
- How a payer should bind the x402 `payTo` to the registry value. No standard defines it; we would define it.
- What a buyer should do if the wallet changes between its check and settlement.

**First question:** Is there a recommended way for a payer to bind `payTo` to `agentWallet`, and how should payers handle it changing mid-flow?

## 5. x402 and the facilitator

**Confirmed**
- `@x402/concordium` 2.30.0 is in the official x402 repository, with client, server and facilitator roles for the `exact` scheme [source]. It depends on `@concordium/web-sdk ^12.0.0`, which our pinned 12.0.2 satisfies.
- `@x402/concordium`, `@x402/mcp` and `@x402/core` (all 2.30.0) install and import on Node 22.23.4, including the client, server and facilitator subpaths [live, tested].
- The public facilitator at `x402.org/facilitator` does not list Concordium in its supported networks [live]. We must run our own facilitator.
- Payment assets: native CCD, or a protocol-level token by symbol. `USDR` is the default asset on both networks; `EURR` appears in examples [source].
- The facilitator enforces nine rules before sponsoring, including sponsor equals `extra.feePayer`, exact `payTo` and amount, expiry within 10 minutes, and a single operation [source].
- Key handling is by environment variable only (names in the package README: client address and key, facilitator address and key). We store no keys in the repo.
- A source commit removed a check that blocked one operator from running both the facilitator and the resource server [source], so our validator service can host its own facilitator.
- The sponsor field accepts both `address` and `account` (`account` is a documented compatibility alias) [source].

**UNVERIFIED**
- Whether `@x402/mcp` works with the Concordium scheme. Its README demonstrates only EVM.
- Whether `@x402/mcp` spend controls (default assets, a per-payment cap) accept native CCD or only the default asset.
- How to obtain test funds to pay with (see risk 1).
- A ready-made HTTP facilitator server. The package provides the scheme, not a server; I did not inspect the repo's examples.

**Discrepancy:** The Concordium docs x402 page describes the client sending a CCD transaction and submitting its hash. The package and spec describe a sponsored flow where the client never broadcasts. I treat the package and spec as current.

**First question:** Is there a hosted or reference Concordium facilitator for the hackathon, and can organisers issue test USDR to our payer account?

## 6. Sponsored fees

**Confirmed**
- Protocol 10 introduced protocol-level sponsored transactions [docs]. Testnet reports protocol version 10 [live].
- Sender and sponsor both sign. The fee is charged to the sponsor, and the sender's fee is zero [docs].
- The chain rejects a transaction with a missing or invalid signature, an under-funded sponsor, or an expired transaction [docs].
- Sponsored transactions cost somewhat more energy (100 per extra signature, plus 34 for the header) [docs].
- The sponsor needs CCD; the sender can hold only the payment token [docs].
- x402 uses this: the client names the facilitator as sponsor [source].
- Native CCD testnet faucet: one request per account, and only before the account has incoming transactions [source README].

**UNVERIFIED**
- Whether testnet sponsor or payer accounts need identity or KYB steps. The sponsor tutorial mentions KYB.
- The CCD fee amount on testnet.
- Whether sponsorship applies if we pay in native CCD (it should still cover the fee, but I have not seen it stated).

**First question:** For the hackathon testnet, do sponsor and payer accounts need identity setup, and how do we fund a facilitator account with enough CCD?

## 7. MCP

**Confirmed**
- The hosted registry MCP at `https://agent-registry-mcp.concordium.com/mcp` exposes 40 tools, is open (no auth, open CORS) and rate-limited per IP [docs, live].
- It answered a protocol version `2025-06-18` request with `2024-11-05`, and I sent the header `accept: application/json, text/event-stream` (I did not test without it) [live].
- It holds no keys; builder tools return sign-ready payloads [docs, live].
- Testnet is configured, with an indexer, so discovery tools work [live].
- Our paid tool would use `@modelcontextprotocol/sdk` plus `@x402/mcp`. Flow: tool call, an `isError` result carrying the payment request, then a retry with the payment in `_meta["x402/payment"]` [source].
- Our MCP endpoint is advertised in the card's `services` list [docs, EIP].

**UNVERIFIED**
- Which MCP transport judges' clients expect.
- Whether judges' MCP clients can complete an x402 payment, or whether we must ship a client.
- Design consequence: signing a payment needs `@concordium/web-sdk`, so the buyer role must run in Node. The existing escrow agent would call a Node-side buyer module.

**First question:** Which MCP transport and client will judges use to call paid tools, and can they pay on testnet?

## The five riskiest assumptions

1. **We can obtain something to pay with on testnet.** Native CCD comes from a once-per-account faucet. A stablecoin token (USDR) has no public faucet and needs a manual issuance request, and `@x402/mcp` defaults to default assets. If neither works, the paywalled demo cannot run.
2. **We can turn the registry's payload into an accepted transaction.** This step is undocumented. Registration, card updates and wallet changes all depend on it.
3. **`@x402/concordium` and `@x402/mcp` work together end to end.** Each works alone on Node 22, but the combination is unshown, and we must run the facilitator ourselves.
4. **Testnet identity and account prerequisites are small.** Concordium's model is identity-backed accounts. If testnet onboarding for the owner, payer or sponsor takes days, the 9 December deadline is at risk.
5. **Our host stays reachable and byte-exact.** A free-tier host that sleeps could make the card fetch time out, so a buyer or judge would see `match: false` or a failed badge check exactly when it matters. Any change to the served bytes breaks the hash pin.
