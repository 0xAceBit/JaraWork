/**
 * eBay Fulfillment API adapter — server-side OAuth flow
 *
 * OAuth flow (handled server-side):
 *   1. User clicks "Connect eBay" → GET /api/ebay/install
 *   2. Server redirects to eBay consent page
 *   3. eBay redirects to GET /api/ebay/callback?code=...
 *   4. Server exchanges code for access_token, stores it, returns to frontend
 *
 * fetchOrders proxies through /api/ebay/orders (no credentials in browser)
 */
import type { MarketplaceAdapter, MarketplaceOrder } from './types'

function str(v: unknown, fallback = ''): string {
  if (v === null || v === undefined) return fallback
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return fallback
}

export const ebayAdapter: MarketplaceAdapter = {
  id: 'ebay',
  name: 'eBay',

  async test(_apiKey: string, _extra?: Record<string, string>): Promise<boolean> {
    try {
      const res = await fetch('/api/ebay/ping')
      return res.ok
    } catch {
      return false
    }
  },

  async fetchOrders(_apiKey: string, _extra?: Record<string, string>): Promise<MarketplaceOrder[]> {
    try {
      const res = await fetch('/api/ebay/orders')
      if (!res.ok) return []
      const data = await res.json() as { orders?: unknown[] }
      const orders = (data.orders ?? []) as Array<Record<string, unknown>>
      return orders.map((o) => {
        const lineItems = Array.isArray(o.lineItems) ? o.lineItems as Array<Record<string, unknown>> : []
        const firstTitle = lineItems.length > 0 ? str(lineItems[0]?.title) : ''
        const pricing = o.pricingSummary as Record<string, Record<string, string>> | undefined
        const totalValue = str(pricing?.total?.value ?? o.total) || '1.00'
        return {
          externalId:        str(o.orderId ?? o.id) || String(Math.random()),
          title:             str(o.title) || firstTitle || 'eBay Order',
          description:       `eBay order ${str(o.orderId)}`,
          usdcAmount:        totalValue,
          sourceMarketplace: 'ebay',
          rawData:           o,
        }
      })
    } catch {
      return []
    }
  },
}
