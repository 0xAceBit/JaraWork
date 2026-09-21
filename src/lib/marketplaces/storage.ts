/**
 * Browser localStorage helpers for marketplace API keys
 * Keys are stored only in the user's browser — never on-chain or on any server
 */
import type { MarketplaceKeys } from './types'

const STORAGE_KEY = 'jarawork_marketplace_keys'

export function loadMarketplaceKeys(): MarketplaceKeys {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as MarketplaceKeys
  } catch {
    return {}
  }
}

export function saveMarketplaceKeys(keys: MarketplaceKeys): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
}

export function clearMarketplaceKeys(): void {
  localStorage.removeItem(STORAGE_KEY)
}
