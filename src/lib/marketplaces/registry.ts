/**
 * Marketplace adapter registry
 * Import adapters and look them up by id
 */
import { jaramarketAdapter } from './jaramarket'
import { amazonAdapter } from './amazon'
import { ebayAdapter } from './ebay'
import { jumiaAdapter } from './jumia'
import type { MarketplaceAdapter } from './types'

export const ADAPTERS: Record<string, MarketplaceAdapter> = {
  jaramarket: jaramarketAdapter,
  amazon: amazonAdapter,
  ebay: ebayAdapter,
  jumia: jumiaAdapter,
}

export function getAdapter(id: string): MarketplaceAdapter | undefined {
  return ADAPTERS[id]
}
