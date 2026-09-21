Based on your answers, let me read the relevant skills before generating the plan. Good. I have everything I need. Here is the full implementation plan based on your answers:

---

## Implementation Plan: JaraWork — Order-to-Earner Marketplace Agent

### Summary
A decentralized gig marketplace that pulls orders from Jaramarket.store (and optionally Amazon, eBay, Jumia via user-provided API keys), broadcasts them as claimable tasks to registered workers/earners, and settles payment in USDC through an on-chain escrow — released only after the buyer confirms delivery.

---

### Architecture

- **Blockchain:** Arc Testnet — USDC is the native gas token, making escrow payouts predictable and cheap
- **Contract:** `JaraWorkEscrow.sol` — handles order creation (by buyer/platform), worker claiming, USDC deposit into escrow, delivery confirmation, and refund/dispute paths
- **Frontend:** React + Tailwind, four main views: Order Board, My Claims (worker), Create Order (buyer/admin), and API Key Settings (marketplace integrations)
- **Wallet:** ConnectKit — workers and buyers connect their own wallets

---

### Contract: `JaraWorkEscrow.sol`

Key functions:
- `createOrder(orderId, description, usdcAmount)` — buyer deposits USDC into escrow, order appears on board
- `claimOrder(orderId)` — worker claims an open order (first-come, first-served)
- `submitDelivery(orderId, proofHash)` — worker marks order done, attaches delivery proof hash
- `confirmDelivery(orderId)` — buyer releases escrow to worker
- `refundOrder(orderId)` — buyer can refund if worker hasn't claimed (timeout-protected)
- `disputeOrder(orderId)` — opens dispute for admin/platform resolution

---

### Files to Create / Modify

1. `contracts/JaraWorkEscrow.sol` — escrow contract with order lifecycle state machine
2. `src/wagmi.ts` — wagmi + ConnectKit config for Arc Testnet
3. `src/App.tsx` — top-level shell: routing between views, wallet header
4. `src/components/OrderBoard.tsx` — live list of open orders workers can claim
5. `src/components/CreateOrder.tsx` — buyer form: description, USDC amount, source marketplace tag
6. `src/components/MyOrders.tsx` — worker's claimed orders, submit delivery, track status
7. `src/components/MarketplaceSettings.tsx` — per-user API key config (Jaramarket, Amazon, eBay, Jumia); keys stored locally in browser, never on-chain
8. `src/hooks/useEscrow.ts` — wagmi hooks wrapping all contract reads/writes
9. `src/hooks/useMarketplaceOrders.ts` — polling hook that fetches orders from configured marketplaces using the user's own API keys and pushes them into the contract
10. `src/lib/marketplaces/jaramarket.ts` — Jaramarket.store REST adapter (polls new orders)
11. `src/lib/marketplaces/amazon.ts` — Amazon SP-API adapter (requires seller API key)
12. `src/lib/marketplaces/ebay.ts` — eBay Browse/Fulfillment API adapter
13. `src/lib/marketplaces/jumia.ts` — Jumia Seller API adapter
14. `src/lib/marketplaceRegistry.ts` — unified interface all adapters implement

---

### Build Sequence

1. **Write and deploy `JaraWorkEscrow.sol`** — escrow state machine, USDC transfer logic, events for order lifecycle; security review included before deploy
2. **Wire wagmi config** (`src/wagmi.ts`) — Arc Testnet chain, ConnectKit, USDC address from `onchain-facts`
3. **Build `useEscrow.ts` hook** — reads orders from contract, wraps `createOrder`, `claimOrder`, `submitDelivery`, `confirmDelivery`
4. **Build `OrderBoard.tsx`** — shows all open/claimed/completed orders from on-chain events; workers claim from here
5. **Build `CreateOrder.tsx`** — buyer deposits USDC and creates an order, can tag it with marketplace source
6. **Build `MyOrders.tsx`** — worker dashboard: claimed orders, submit delivery with proof note, track escrow state
7. **Build marketplace adapters** (Jaramarket first, then Amazon/eBay/Jumia stubs) and `useMarketplaceOrders.ts` polling hook
8. **Build `MarketplaceSettings.tsx`** — API key input form per platform, stored in `localStorage`; real-time test button per integration
9. **Wire `App.tsx`** — tab navigation: Order Board / Create Order / My Orders / Settings

---

### Done When

- [ ] Worker can connect wallet, see open orders from the board, and claim one
- [ ] Buyer can connect wallet, fill a form with amount + description, approve + deposit USDC into escrow
- [ ] Worker submits delivery; buyer confirms; USDC is released to worker's wallet on Arc Testnet
- [ ] Buyer can get a refund on an unclaimed order
- [ ] Jaramarket.store adapter polls for new orders and surfaces them on the board (using the user's own API key)
- [ ] Amazon, eBay, and Jumia adapters accept user-supplied API keys and fetch live orders when keys are present
- [ ] All API keys stored only in the user's browser — never sent on-chain or to any server
- [ ] Marketplace settings page lets the user add/remove keys and test each connection

---

### Important Note on Marketplace API Keys

Each platform (Amazon, eBay, Jumia, Jaramarket) requires its own developer credentials:
- **Jaramarket** — you will need to expose a REST or webhook endpoint on jaramarket.store
- **Amazon** — requires Amazon SP-API seller credentials (MWS access key + secret)
- **eBay** — requires eBay Developer Program app credentials
- **Jumia** — requires Jumia Seller API key (availability varies by country)

The app will have a Settings screen where workers/buyers paste their own keys. Nothing touches your server — it all runs in the browser.

---

## Ready to build?

Switch to **Build mode** to start. The contract will be written and reviewed before anything deploys, and the marketplace adapters will be built starting with Jaramarket, then expanding to Amazon, eBay, and Jumia. Plan saved to `arc-studio-plans/PLAN.md`.

A few things worth flagging before you hit Build:

**On the marketplace API keys question you asked** — yes, users can supply their own API keys from Amazon, eBay, Jumia, and Jaramarket directly in the app. Each worker or buyer enters their own credentials in the Settings screen. Those keys live only in their browser (`localStorage`) and are used client-side to poll for new orders. Nothing is stored on a server or put on-chain. This is the safest and most practical approach since each seller has their own account on those platforms.

**Real-time notifications** — browser polling every 30–60 seconds is the realistic approach here. True push notifications from Amazon/eBay/Jumia require a publicly accessible server endpoint to receive their webhooks, which is outside the browser sandbox. The plan uses polling as the default; if you later want webhooks, that would need a small backend relay server.

**Jaramarket specifically** — you will need to either expose an API endpoint on jaramarket.store or enable webhooks on your store platform (Shopify, WooCommerce, etc.) for the integration to pull live orders. The adapter is built to support both; we can configure the exact endpoint once you confirm how jaramarket.store is set up.

Switch to **Build mode** when ready and everything will be built in the sequence above.
