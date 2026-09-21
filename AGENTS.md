# [App Name]

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

[Brief description of what the app does and its primary use case]

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## Deployed Contracts

| Contract | Address | Chain | Notes |
|---|---|---|---|
| JaraWorkEscrow v3 | `0x9e820abe45420bf544331c39dc0b5fed738abbc2` | Arc Testnet | owner=0x362f5b..., platform=agent wallet; txHash: 0x0637c8d101297be6556da81ddc415d6e6bfb4d26644fad80fd36d776753a303e |
| JaraWorkEscrow v2 | `0xd454036b54c5be123e2e3331fd9363df14400af5` | Arc Testnet | Platform agent role; feeBps=250 (deprecated) |
| JaraWorkEscrow v1 | `0x74eb073bee50937a762cdd3836ca1b3b12919c5d` | Arc Testnet | Original, no platform role |

## Agent Wallet

| Field | Value |
|---|---|
| Wallet ID | `7f22a1e9-e12f-546d-9bb0-37ec5e5711bd` |
| Wallet Set ID | `5426021b-7e4a-5163-8a8c-e38a8c725e37` |
| Address | `0xa7d90f5f3654a9d7da551fd24a4fba593a24fde6` |
| Chain | Arc Testnet |

Next: fund the wallet with testnet USDC, then call `setPlatform(0xa7d90f5f3654a9d7da551fd24a4fba593a24fde6)` on the escrow contract (owner-only) to activate autonomous mode.

## To Run

```bash
bun install
bun run dev       # frontend on :5173
bun run agent     # autonomous agent backend on :3001
```
