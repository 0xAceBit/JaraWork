# 01. validate_delivery_proof: request, response, checks

Status: design only, nothing here is implemented yet. Written 2026-11-05.

## Principles

- The input is the exact string stored in the escrow order's `deliveryProof`. We reuse the repo's existing proof format (`src/components/DeliveryModal.tsx`) and do not invent a second one.
- The validator never sees order amounts, buyer, worker or marketplace. It gets the proof and an optional opaque reference. Nothing else.
- Evidence is labelled honestly. A check that is simulated says so in the response.
- Proofs are untrusted text. Callers may be LLM agents, so the response never echoes raw proof content or fetched page content.

## Input format (already in the repo)

```json
{"type":"tracking|url|ipfs|text","value":"...","carrier":"UPS|FedEx|USPS|DHL|Other|","note":"..."}
```

- A string that is not valid JSON is treated as `text`, exactly like the repo's `parseDeliveryProof`.
- `note` is ignored by every check and never returned.
- Input longer than 1024 characters is rejected (on-chain proofs are about 500 characters).

## Tool request

```json
{ "proof": "<exact on-chain string>", "orderRef": "optional, max 64 chars, [A-Za-z0-9._:-]" }
```

## Tool response (structuredContent, also JSON in the first text item)

```json
{
  "schemaVersion": "1",
  "pass": true,
  "kind": "url",
  "code": "OK",
  "reason": "HTTPS link is reachable (HTTP 200).",
  "retryable": false,
  "checks": [
    { "name": "format", "ok": true },
    { "name": "reachable", "ok": true }
  ],
  "proofSha256": "<hex sha256 of the exact input string>",
  "orderRef": "ord-123",
  "validatedAt": "2026-11-20T10:00:00.000Z",
  "validator": { "name": "jarawork-proof-validator", "version": "0.1.0" }
}
```

Rules for every response:

- `pass` is true only when every required check for the kind is `ok`. A check with `"simulated": true` does not count unless the service runs in demo mode.
- `reason` is at most 200 characters and built from fixed templates. It never contains the raw proof or anything fetched.
- `retryable` is true only for transient network failures.
- `proofSha256` lets the buyer log an audit trail without storing the proof.

## Codes

| Code | Meaning | retryable |
| --- | --- | --- |
| OK | All required checks passed | no |
| BAD_ENVELOPE | JSON parsed but `type` or `value` is missing or unknown | no |
| INVALID_FORMAT | Value does not match the declared type | no |
| CARRIER_MISMATCH | Tracking number does not match the declared carrier | no |
| BLOCKED_TARGET | Host resolves to a private or internal address | no |
| UNREACHABLE | Link or content could not be fetched (DNS, TLS, 4xx) | no |
| TIMEOUT | Fetch timed out or got a 5xx | yes |
| NOT_CONFIRMED | Carrier status did not confirm delivery | no |
| NOT_VERIFIABLE | Free text cannot be machine-checked | no |
| INTERNAL | Validator fault | yes |

## Required checks per kind

| Kind | Required checks | What a pass really proves |
| --- | --- | --- |
| url | `format`: https only, public hostname, no credentials, port 443. `reachable`: GET of the first byte, 2xx or 206, at most 3 redirects with each hop re-validated, 5 s timeout, no cookies | The link works and is public. It does not prove the page shows the delivery |
| ipfs | `format`: CIDv0 or CIDv1 sha2-256, bare or `ipfs://`. `retrievable`: first byte through the configured gateway list, 8 s | Someone is serving this content. It does not prove what the content shows |
| tracking | `format`: matches the declared carrier. `carrier_status`: SIMULATED by a fixture table in the hackathon build, real carrier APIs in production | Format only, until a real carrier lookup replaces the simulation |
| text | none can pass | Nothing. Always `NOT_VERIFIABLE`, never releases |

## Differences from the in-browser checks (and why they matter)

The repo's UI validators are looser than the validator we built in step 1:

| Rule | Repo UI today | Validator |
| --- | --- | --- |
| URL scheme | http or https | https only |
| Local hosts and IP addresses | accepted | blocked |
| Carrier patterns | unanchored regexes (FedEx `\d{12,22}`, USPS `9\d{15,21}`, DHL `\d{10,11}`) | same patterns, anchored |
| Carrier `Other` | any value of 6+ characters | must match a known shape |

Decision: when a carrier is declared, use the repo's patterns, anchored, so a number the UI accepted is not rejected for a stricter rule. The stricter auto-detection from step 1 applies only to `Other`. Anchoring can still reject text like "Tracking: 1Z999..." that the UI accepted.

Consequence to state in the README: JaraWork targets emerging markets, and local carriers will often fall under `Other`. Format-only checks will flag some honest deliveries. This is a reason the production gate is advisory first (see 02).

## SSRF and abuse rules (URL and IPFS fetches)

- Resolve DNS, then connect to the resolved address. Block loopback, private, link-local, CGNAT, multicast, unique-local IPv6 and IPv4-mapped IPv6.
- Re-check every redirect hop. Never follow a redirect to a blocked address.
- No proxy variables, no cookies, no custom headers from the caller.
- Read at most 1 KiB of body. Cap concurrent fetches. Keep a global per-minute limit.
- Callers pay per call, so abuse costs the attacker, but the caps stay.

## Price

The price is a config value, `PRICE_MICRO_CCD` (native CCD has 6 decimals). No number is fixed here. It is set after the first settled sponsored payment shows the real fee on testnet, because the price must exceed what the sponsor pays per call.

## What changes in the step-1 code

- Accept the repo's JSON envelope and use the declared `type` and `carrier`.
- Add the `text` kind, `code`, `retryable`, `checks`, `proofSha256` and `validator`.
- Keep the existing format checks (all 13 tests stay).
- Add `reachable`, `retrievable` and the simulated `carrier_status` as separate, individually tested modules.
