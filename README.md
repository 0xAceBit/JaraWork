# JaraWork — Order-to-Earner Marketplace

> **Live app:** [jarawork.onrender.com](https://jarawork.onrender.com)  
> **Network:** Arc Mainnet (Chain ID 5042) · USDC native gas  
> **Contract:** [`0x52A34aD73fAe6Bd151F25F1BCDf13AA7781422d5`](https://explorer.arc.io/address/0x52A34aD73fAe6Bd151F25F1BCDf13AA7781422d5)

---

JaraWork is an Order-to-Earner Marketplace designed to bring the fragmented e-commerce ecosystem into one connected platform.

Today, sellers and buyers operate across multiple marketplaces — eBay, Amazon, Shopify, Jumia, and other regional and specialized commerce platforms. Managing products, monitoring demand, finding customers, processing orders, and coordinating business activities across these platforms can be time-consuming and fragmented.

JaraWork aims to change that.

The vision is to create a single application where users can connect their e-commerce activities across multiple platforms, discover opportunities, interact with buyers and sellers, and execute market activities from one unified environment.

---

## One Platform. Multiple Marketplaces.

JaraWork is designed to serve as a centralized commerce layer that connects with established e-commerce platforms and storefronts, including:

- **eBay** — OAuth seller account integration
- **Amazon** — SP-API seller account integration
- **Shopify** — Partners OAuth app integration
- **Jumia** — Seller API key integration
- Other supported marketplaces and independent online stores

Instead of constantly switching between different platforms, users can manage and coordinate their commerce activities through a single interface.

---

## Autonomous Market Activities

JaraWork is built with automation and intelligent agents at its core.

Routine market activities are handled autonomously based on user-defined instructions, permissions, and objectives. The platform agent wallet operates on-chain, managing escrow creation, payment release, and refunds without requiring manual intervention.

Activities handled autonomously include:

- Monitoring marketplace orders and new opportunities
- Creating on-chain USDC escrow for each order
- Tracking order claims and delivery submissions
- Auto-releasing payment after successful delivery confirmation
- Auto-refunding stale or unclaimed orders
- Flagging disputes for resolution
- Sending real-time push notifications to workers
- Maintaining a retry queue for failed transactions

Rather than simply displaying information, JaraWork helps users move from discovering an opportunity to taking action within the same environment.

---

## Connecting Buyers and Sellers

At the center of JaraWork is a simple objective: make commerce easier to access and safer to execute.

The platform creates an environment where buyers can post orders and workers can discover and fulfill them, without navigating multiple disconnected systems.

Users can discover an opportunity, evaluate the relevant information, communicate where necessary, and move toward completing a transaction with minimal friction.

---

## A Safer Business Environment

JaraWork addresses one of the biggest challenges in online commerce: trust.

The escrow model ensures payment is locked on-chain before a worker begins, and only released when delivery is confirmed. Built-in features support:

- **On-chain escrow** — USDC locked in a non-custodial smart contract
- **Worker reputation scoring** — tracked on-chain per address
- **Delivery proof validation** — tracking numbers, URLs, IPFS hashes, or text
- **Dispute resolution** — owner-controlled dispute workflow with Pay Worker / Refund Buyer actions
- **Transaction transparency** — all activity verifiable on Arc Mainnet explorer
- **Fraud-risk awareness** — order age and status visible to all participants
- **Clear transaction records** — full order history per wallet

---

## From Order to Earner

The name *Order-to-Earner* reflects the broader vision of JaraWork.

An order should not simply represent a transaction. It creates an economic opportunity for multiple participants across the commerce ecosystem.

JaraWork connects the different stages of this process:

```
Discover → Match → Order → Fulfill → Earn
```

By bringing these activities into one connected environment, JaraWork evolves from an e-commerce management tool into a broader commerce coordination platform.

---

## Technical Stack

| Layer | Technology |
|---|---|
| Smart contract | Solidity (OpenZeppelin), deployed on Arc Mainnet |
| Payments | USDC native gas on Arc — no ETH needed |
| Agent wallet | Circle Developer-Controlled Wallets |
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Wallet connection | wagmi + ConnectKit |
| Backend agent | Bun + TypeScript, autonomous polling loop |
| Deployment | Docker on Render |
| Marketplace OAuth | Shopify Partners, eBay Developer Program, Amazon SP-API |

---

## The Bigger Vision

JaraWork's long-term vision is to become an intelligent layer connecting marketplaces, stores, buyers, sellers, and autonomous commerce agents.

Instead of users manually navigating dozens of platforms and repeating the same activities, JaraWork aims to provide a single point of interaction where commerce can be discovered, coordinated, and executed — with agents handling the routine and humans staying in control of what matters.

---

## Getting Started (Local Development)

```bash
# Clone the repo
git clone https://github.com/0xAceBit/JaraWork.git
cd JaraWork

# Install dependencies
bun install

# Copy env template and fill in your keys
cp .env.example .env

# Start the frontend
bun run dev

# Start the agent backend (separate terminal)
bun run server/agent.ts
```

Required environment variables (see `.env.example`):

```
CIRCLE_MAINNET_API_KEY=
CIRCLE_MAINNET_ENTITY_SECRET=
VITE_MAINNET_ESCROW_CONTRACT_ADDRESS=0x52A34aD73fAe6Bd151F25F1BCDf13AA7781422d5
VITE_MAINNET_AGENT_WALLET_ID=
VITE_MAINNET_AGENT_WALLET_ADDRESS=
AGENT_BLOCKCHAIN=ARC
```

---

## License

MIT
