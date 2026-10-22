Let me read the current app structure and design system before building the landing page. Good — I have the full design system. Now I'll build the landing page as a standalone component that shows before the main app and matches the warm amber palette perfectly.I'm in Plan mode. Here's the full plan for what will be built — approve it and I'll write all the files immediately.

---

## Landing Page Plan

**New file:** `src/components/LandingPage.tsx`

A full-screen landing page that shows before the main app. Sections:

1. **Nav** — JaraWork logo + "Launch App" button
2. **Hero** — same amber gradient as the in-app hero, bigger headline, "Enter App" + "View Source" CTAs
3. **Marketplaces** — pill row: eBay, Amazon, Shopify, Jumia, Jaramarket
4. **How it works** — 4 steps: Post → Claim → Deliver → Get paid
5. **Features** — 6 cards: Trustless Escrow, Instant Payments, No Bank Required, Autonomous Agent, Multi-Marketplace, 2.5% Flat Fee
6. **CTA banner** — amber gradient, "Launch JaraWork" button
7. **Footer** — Ace Corporation, contract link, GitHub link

**Change to `App.tsx`:** Add a `showLanding` state. If `true`, render `<LandingPage onEnterApp={() => setShowLanding(false)} />` instead of the main app. Persists the "entered" state in `localStorage` so returning users skip the landing.

**Nothing else changes** — no contract code, no agent, no escrow logic.

Switch to **Build mode** to build it.
