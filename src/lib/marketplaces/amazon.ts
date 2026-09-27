/**
 * Amazon SP-API adapter — server-side OAuth flow (Login with Amazon / LWA)
 *
 * OAuth flow (handled server-side):
 *   1. User clicks "Connect Amazon" → GET /api/amazon/install
 *   2. Server redirects to Amazon LWA consent page
 *   3. Amazon redirects to GET /api/amazon/callback?code=...&state=...
 *   4. Server exchanges code for refresh_token, stores it, returns to frontend
 *
 * fetchOrders proxies through /api/amazon/orders (no credentials in browser)
 */
import type { MarketplaceAdapter, MarketplaceOrder } from './types'

function str(v: unknown, fallback = ''): string {
  if (v === null || v === undefined) return fallback
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return fallback
}

export const amazonAdapter: MarketplaceAdapter = {
  id: 'amazon',
  name: 'Amazon',

  async test(_apiKey: string, _extra?: Record<string, string>): Promise<boolean> {
    try {
      const res = await fetch('/api/amazon/ping')
      return res.ok
    } catch {
      return false
    }
  },

  async fetchOrders(_apiKey: string, _extra?: Record<string, string>): Promise<MarketplaceOrder[]> {
    try {
      const res = await fetch('/api/amazon/orders')
      if (!res.ok) return []
      const data = await res.json() as { orders?: unknown[] }
      const orders = (data.orders ?? []) as Array<Record<string, unknown>>
      return orders.map((o) => {
        const orderTotal = o.OrderTotal as Record<string, string> | undefined
        const usdcAmount = str(orderTotal?.Amount ?? o.total) || '1.00'
        return {
          externalId:        str(o.AmazonOrderId ?? o.id) || String(Math.random()),
          title:             str(o.Title ?? o.title) || 'Amazon Order',
          description:       `Amazon order ${str(o.AmazonOrderId)}`,
          usdcAmount,
          sourceMarketplace: 'amazon',
          rawData:           o,
        }
      })
    } catch {
      return []
    }
  },
}
