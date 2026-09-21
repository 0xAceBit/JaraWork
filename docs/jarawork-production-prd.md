# JaraWork — Production Readiness Document
**Version:** 1.0  
**Date:** September 21, 2026  
**Project:** JaraWork Order-to-Earner Platform  
**Contract:** `0xf34d22b12d168925d4f0ffde2e3fe769e7f15440` (Arc Testnet)  
**Agent Wallet:** `0xa7d90f5f3654a9d7da551fd24a4fba593a24fde6`

---

## Executive Summary

JaraWork is an autonomous marketplace-order-to-worker platform built on Arc Testnet. Orders from Jaramarket, Amazon, eBay, and Jumia are ingested by a Circle developer-controlled agent wallet, posted as USDC escrow orders on-chain, claimed by workers worldwide, and paid automatically on delivery confirmation. The platform is functionally complete for testnet demonstration. This document tracks every gap that must be closed before a public mainnet launch.

---

## What Is Already Complete

| Area | Status |
|---|---|
| Smart contract (escrow, roles, fees, dispute) | Complete |
| Autonomous agent (poll, create, release, refund) | Complete |
| Frontend — Order Board, Post, My Orders, Agent, Settings | Complete |
| Wallet connection + chain switching | Complete |
| USDC approve → createOrder two-step flow | Complete |
| Worker claim + delivery submission | Complete |
| Buyer confirm + auto-release (24h timer) | Complete |
| Auto-refund unclaimed orders (7-day timer) | Complete |
| Jaramarket adapter (REST + Bearer token) | Complete |
| Amazon adapter (stub — credentials needed) | Stub |
| eBay adapter (stub — OAuth needed) | Stub |
| Jumia adapter (direct + relay fallback) | Complete |
| Glass UI redesign with animated hero | Complete |
| Arc Testnet deployment + platform role set | Complete |

---

## Section 1 — Critical Gaps (Blocks Real Use)

These items must be resolved before any real user can safely use the platform.

---

### 1.1 Order Dedup Persistence

**Priority:** P0  
**Effort:** Small (1–2 hours)

**Problem:**  
The agent tracks which marketplace orders have already been posted to the chain using an in-memory JavaScript `Set` (`postedKeys`). Every time the agent server restarts — including a Render deploy, a crash, or a routine restart — this Set is wiped. On the next poll cycle, every previously posted order from every configured marketplace will be re-submitted as a brand-new on-chain order, creating duplicate escrow entries and double-charging the agent wallet's USDC balance.

**Required fix:**  
Persist `postedKeys` to a local JSON file (e.g. `.data/posted-keys.json`) that survives restarts. On startup, read the file and pre-populate the Set. On each new post, append the key to the file atomically. On Render, mount a persistent disk volume to the `.data/` path so the file survives redeployments.

**Acceptance criteria:**  
- Restarting the agent server does not cause any previously posted order to be posted again.  
- The `.data/` directory is excluded from `.gitignore` only if using a persistent volume; otherwise it is included with an empty `.gitkeep`.

---

### 1.2 Amazon SP-API Relay (Not Implemented)

**Priority:** P0  
**Effort:** Medium (4–6 hours)

**Problem:**  
The `/api/amazon/orders` endpoint currently returns an empty array with a stub note. No Amazon orders will ever flow through JaraWork until this is implemented. Amazon SP-API requires SigV4 request signing — a non-trivial auth scheme that cannot be done from the browser.

**Required fix:**  
Implement the server-side relay in `server/agent.ts`:
1. Accept `AMAZON_CLIENT_ID`, `AMAZON_CLIENT_SECRET`, `AMAZON_REFRESH_TOKEN`, and `AMAZON_MARKETPLACE_ID` from `.env`.
2. Exchange the refresh token for a bearer token via `POST https://api.amazon.com/auth/o2/token`.
3. Sign `GET https://sellingpartnerapi-na.amazon.com/orders/v0/orders?OrderStatuses=Unshipped` using AWS SigV4.
4. Map each order to the `MarketplaceOrder` format: `{ externalId, title, description, usdcAmount, sourceMarketplace: 'amazon' }`.
5. Return the array. The existing adapter in `src/lib/marketplaces/amazon.ts` will call this endpoint.

**Credentials required (your Seller Central account):**  
- `AMAZON_CLIENT_ID`  
- `AMAZON_CLIENT_SECRET`  
- `AMAZON_REFRESH_TOKEN`  
- `AMAZON_MARKETPLACE_ID` (e.g. `ATVPDKIKX0DER` for US)

**Acceptance criteria:**  
- With valid credentials in `.env`, the agent polls Amazon orders and posts them on-chain automatically.  
- With missing credentials, the relay returns an empty array gracefully (no crash).

---

### 1.3 eBay Fulfillment API Relay (Not Implemented)

**Priority:** P0  
**Effort:** Medium (3–4 hours)

**Problem:**  
The `/api/ebay/orders` endpoint currently returns an empty array with a stub note. No eBay orders flow through JaraWork until this is implemented.

**Required fix:**  
Implement the server-side relay in `server/agent.ts`:
1. Accept `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` from `.env`.
2. Fetch a client credentials OAuth2 token: `POST https://api.ebay.com/identity/v1/oauth2/token` with `grant_type=client_credentials` and scope `https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly`.
3. Call `GET https://api.ebay.com/sell/fulfillment/v1/order?filter=orderfulfillmentstatus:{NOT_STARTED|IN_PROGRESS}`.
4. Map each order to `MarketplaceOrder` format.
5. Cache the token for its `expires_in` duration to avoid re-fetching on every poll.

**Credentials required (eBay Developer account):**  
- `EBAY_CLIENT_ID`  
- `EBAY_CLIENT_SECRET`

**Acceptance criteria:**  
- With valid credentials, eBay orders appear in the agent poll cycle and are posted on-chain.  
- Token is cached and not re-fetched unnecessarily.  
- With missing credentials, returns empty array gracefully.

---

### 1.4 No Low-Balance Alert on Agent Wallet

**Priority:** P0  
**Effort:** Small (1 hour)

**Problem:**  
If the agent wallet's USDC balance drops to zero, all order creation transactions fail silently. The platform operator has no warning. Orders from marketplaces continue arriving but none are posted on-chain — workers see no orders and the platform appears broken.

**Required fix:**  
- Add a `LOW_BALANCE_THRESHOLD_USDC` env var (default: `5.00`).  
- At the start of each poll cycle, check the agent wallet balance. If below threshold, log an `error`-type action and surface a prominent red banner in the Agent tab UI.  
- Optionally: POST a webhook to `ALERT_WEBHOOK_URL` (if set in `.env`) with a JSON payload describing the low-balance condition.

**Acceptance criteria:**  
- When balance < threshold, the Agent tab shows a red "Low Balance" warning with the current balance and the wallet address to top up.  
- The warning clears automatically on the next poll once balance is above threshold.

---

### 1.5 No Dispute Resolution UI

**Priority:** P0  
**Effort:** Small (2 hours)

**Problem:**  
The smart contract has a `resolveDispute(bytes32 key, bool favorWorker)` function callable only by the owner. There is no UI to call it. Any disputed order is permanently stuck — USDC is locked in escrow forever with no way to release it from the frontend.

**Required fix:**  
Add an Admin section to the Agent tab (visible only when the connected wallet matches the contract owner address):
- List all disputed orders (read from a new `getDisputedOrders()` view function on the contract, or filter from `getOrderKeys`).  
- For each disputed order: show title, buyer, worker, USDC amount, and two buttons: "Pay Worker" and "Refund Buyer".  
- Both buttons call `resolveDispute(key, favorWorker)` via the existing wagmi write hook pattern.

**Acceptance criteria:**  
- Owner wallet sees all disputed orders and can resolve them in one click.  
- Non-owner wallets see no admin section.  
- Resolved orders are removed from the disputed list after tx confirmation.

---

## Section 2 — Important Gaps (Affects Reliability)

These items do not block a launch but will cause friction or data loss in production under real load.

---

### 2.1 Jaramarket Webhook (vs. Polling)

**Priority:** P1  
**Effort:** Medium (3 hours)

**Problem:**  
The Jaramarket adapter polls `<storeUrl>/api/orders?status=pending` every 60 seconds. New orders can take up to 60 seconds to appear on JaraWork. Under load, polling also creates unnecessary API calls.

**Required fix:**  
Add a `POST /api/jaramarket/webhook` endpoint to the agent server. Jaramarket pushes order events to this URL in real time. On receipt, validate the payload with a `JARAMARKET_WEBHOOK_SECRET` HMAC check, then immediately process the order (approve + createOrder) without waiting for the next poll cycle.

**Acceptance criteria:**  
- New Jaramarket orders appear as on-chain escrow orders within 5 seconds of being placed.  
- Invalid or unsigned webhook payloads are rejected with HTTP 401.

---

### 2.2 Order Board Pagination

**Priority:** P1  
**Effort:** Small (2 hours)

**Problem:**  
`getOpenOrders()` returns every open order key in a single RPC call. With 50+ open orders this is slow; with 500+ it will time out or hit gas estimation limits. All order data is fetched regardless of what the user can see.

**Required fix:**  
Replace the single `getOpenOrders()` call with paginated reads using the existing `getOrderKeys(offset, limit)` contract function. Show 20 orders per page with "Load more" pagination. The order count from `getOrderCount()` drives the total display.

**Acceptance criteria:**  
- Order Board loads in under 1 second with 500+ total orders.  
- "Load more" appends the next page without a full re-fetch.

---

### 2.3 Worker Notifications

**Priority:** P1  
**Effort:** Medium (4 hours)

**Problem:**  
Workers have no way to know when a new order arrives. They must manually open the app and refresh the Order Board. This makes the platform unusable for serious workers who can't monitor the app constantly.

**Required fix (two options, pick one):**  
- **Option A — Web Push:** Implement browser push notifications. When a worker visits the app, prompt for notification permission. When a new order is posted on-chain (detected via contract event log polling), push a notification to all subscribed workers.  
- **Option B — Email/webhook:** Add an optional `WORKER_ALERT_WEBHOOK_URL` env var. When a new order is created, POST the order details to the URL. The operator connects this to an email service (SendGrid, Resend) or Slack.

**Acceptance criteria:**  
- Workers receive a notification within 90 seconds of a new order being posted on-chain.

---

### 2.4 Agent Error Recovery / Retry Queue

**Priority:** P1  
**Effort:** Medium (3 hours)

**Problem:**  
If `approveUsdc` succeeds but `createOrder` fails (RPC timeout, contract revert, gas spike), the approval is consumed and the order is silently dropped. The order will not be retried because `postedKeys` does not record it (it was never successfully posted). However, the next poll cycle may try again — and if allowance is now 0, `approve` runs again for a potentially different amount.

**Required fix:**  
Introduce a simple retry queue (in-memory + persisted to `.data/retry-queue.json`). On `createOrder` failure after a successful approve:
1. Add the order to the retry queue with a `retryAt = now + 60s` and a `retryCount`.
2. On the next cycle, attempt retry before polling for new orders.
3. After 3 failed retries, log an `error` action and drop the order from the queue.

**Acceptance criteria:**  
- A failed `createOrder` after a successful `approve` is retried up to 3 times.  
- After 3 failures the Agent tab shows an error entry with the order ID and failure reason.

---

## Section 3 — Nice to Have (Polish)

These items improve the experience and trustworthiness of the platform but are not required for launch.

---

### 3.1 Order Search and Filtering

**Priority:** P2  
**Effort:** Small (2 hours)

Add a filter bar to the Order Board: filter by marketplace (All / Jaramarket / Amazon / eBay / Jumia), USDC amount range (min/max), and sort order (newest / highest value). All filtering is client-side against the already-fetched order list — no contract changes needed.

---

### 3.2 Worker Reputation / Completion Score

**Priority:** P2  
**Effort:** Large (1–2 days)

Workers are currently anonymous addresses. Add a simple on-chain or off-chain reputation system:
- Count completed orders per worker address (readable from contract events).  
- Display a "completion rate" badge on the worker address in order cards.  
- Buyers can optionally restrict order claiming to workers above a minimum score.

---

### 3.3 Admin Panel Tab

**Priority:** P2  
**Effort:** Small (2 hours)

Replace the "Activate Platform Role" card in the Agent tab with a dedicated, collapsible Admin section visible only to the contract owner. Includes: current fee bps with an editable field, platform address with a change button, claim timeout setting, and the dispute resolution queue (from 1.5 above). Consolidates all owner actions in one place.

---

### 3.4 Delivery Proof Standards

**Priority:** P2  
**Effort:** Small (1 hour)

The `deliveryProof` field currently accepts any free-form string. In production this creates disputes about what constitutes valid proof. Define and enforce a structured format:
- For physical goods: require a tracking number in format `CARRIER:TRACKINGNUMBER` (e.g. `DHL:1234567890`).  
- For digital work: require a URL or IPFS hash.  
- Validate the format client-side before submission and display the detected type (tracking link, IPFS viewer, URL preview) in the order card.

---

### 3.5 Mainnet Migration Checklist

**Priority:** P2  
**Effort:** Planning

Before launching on Arc mainnet:
- [ ] Obtain an independent security audit of `JaraWorkEscrow.sol`
- [ ] Replace testnet Circle API key (`TEST:...`) with a `LIVE:...` key
- [ ] Re-register entity secret against the live key
- [ ] Fund agent wallet with real USDC on Arc mainnet
- [ ] Deploy contract with mainnet USDC address (`0x3600000000000000000000000000000000000000`)
- [ ] Update all `arcTestnet` chain references to `arc` (chain ID 4506)
- [ ] Remove "Arc Testnet" badges from the UI
- [ ] Set up uptime monitoring on the Render service
- [ ] Configure `ALERT_WEBHOOK_URL` for low-balance and error alerts

---

## Summary Table

| ID | Area | Priority | Effort | Status |
|---|---|---|---|---|
| 1.1 | Order dedup persistence | P0 | Small | Not built |
| 1.2 | Amazon SP-API relay | P0 | Medium | Stub only |
| 1.3 | eBay Fulfillment relay | P0 | Medium | Stub only |
| 1.4 | Low-balance alert | P0 | Small | Not built |
| 1.5 | Dispute resolution UI | P0 | Small | Not built |
| 2.1 | Jaramarket webhook | P1 | Medium | Not built |
| 2.2 | Order board pagination | P1 | Small | Not built |
| 2.3 | Worker notifications | P1 | Medium | Not built |
| 2.4 | Agent retry queue | P1 | Medium | Not built |
| 3.1 | Order search/filter | P2 | Small | Not built |
| 3.2 | Worker reputation | P2 | Large | Not built |
| 3.3 | Admin panel tab | P2 | Small | Not built |
| 3.4 | Delivery proof standards | P2 | Small | Not built |
| 3.5 | Mainnet migration checklist | P2 | Planning | Not started |

---

## Recommended Build Order

**Sprint 1 — Pre-launch blockers (P0)**
Complete 1.1, 1.4, 1.5, then 1.2 + 1.3 (with your marketplace credentials).

**Sprint 2 — Reliability (P1)**
Complete 2.2 (pagination), 2.4 (retry queue), 2.1 (Jaramarket webhook), 2.3 (worker notifications).

**Sprint 3 — Polish + mainnet (P2)**
Complete 3.1, 3.3, 3.4, then run the mainnet checklist (3.5).

---

*Generated by Arc Studio · JaraWork v1.0 · September 2026*
