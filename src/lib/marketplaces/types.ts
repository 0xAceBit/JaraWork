/**
 * Unified interface all marketplace adapters implement
 */
export interface MarketplaceOrder {
  externalId: string
  title: string
  description: string
  usdcAmount: string // human-readable USDC, e.g. "12.50"
  sourceMarketplace: string
  rawData?: Record<string, unknown>
}

export interface MarketplaceAdapter {
  id: string
  name: string
  test(apiKey: string, extraConfig?: Record<string, string>): Promise<boolean>
  fetchOrders(apiKey: string, extraConfig?: Record<string, string>): Promise<MarketplaceOrder[]>
}

export interface MarketplaceKeys {
  jaramarket?: { apiKey: string; storeUrl: string }
  amazon?: { connected: boolean }        // OAuth — token held server-side
  ebay?: { connected: boolean }          // OAuth — token held server-side
  jumia?: { apiKey: string; country: string }
  shopify?: { shop: string; connected: boolean }
}

export const MARKETPLACE_IDS = ['jaramarket', 'amazon', 'ebay', 'jumia', 'shopify', 'manual'] as const
export type MarketplaceId = typeof MARKETPLACE_IDS[number]
