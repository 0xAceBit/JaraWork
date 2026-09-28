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
| JaraWorkEscrow v1 (mainnet) | `0x52A34aD73fAe6Bd151F25F1BCDf13AA7781422d5` | Arc Mainnet (5042) | owner=0xB43218f526c3d0bB9ed205000525E5e4282BF560, platform=0xb7fed760971e29badfe296e255703eb358195346 (mainnet agent wallet); txHash: 0xbdc0ec9136c875ca6a79f361193d00e7a2f906c81c068b46a95a40b36a34df2d; setPlatform tx: 0xfd089bbbcc95bb3aa6e72be0d2b6291d1c6ac7ee7abdbf710648af0787813817 |
| JaraWorkEscrow v5 (testnet) | `0x9e820abe45420bf544331c39dc0b5fed738abbc2` | Arc Testnet (5042002) | owner=0x362f5b..., platform=agent wallet; active testnet contract |
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
