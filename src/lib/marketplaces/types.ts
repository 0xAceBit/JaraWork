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
  amazon?: { accessKey: string; secretKey: string; sellerId: string; marketplaceId: string }
  ebay?: { clientId: string; clientSecret: string }
  jumia?: { apiKey: string; country: string }
}

export const MARKETPLACE_IDS = ['jaramarket', 'amazon', 'ebay', 'jumia', 'manual'] as const
export type MarketplaceId = typeof MARKETPLACE_IDS[number]
