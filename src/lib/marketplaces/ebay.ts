/**
 * eBay Fulfillment API adapter
 * Requires: clientId, clientSecret (eBay developer app credentials)
 * eBay uses OAuth2 — this adapter POSTs to /api/ebay/token then /api/ebay/orders
 * via a thin proxy relay (needed because eBay OAuth requires server-side secrets).
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

  async test(clientId: string, extra?: Record<string, string>): Promise<boolean> {
    try {
      const res = await fetch('/api/ebay/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, clientSecret: extra?.clientSecret }),
      })
      return res.ok
    } catch {
      return false
    }
  },

  async fetchOrders(clientId: string, extra?: Record<string, string>): Promise<MarketplaceOrder[]> {
    const res = await fetch('/api/ebay/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, clientSecret: extra?.clientSecret }),
    })
    if (!res.ok) throw new Error(`eBay relay error: ${res.status}`)
    const data = await res.json() as { orders?: unknown[] }
    const orders = (data.orders ?? []) as Array<Record<string, unknown>>
    return orders.map((o) => {
      // lineItems is an array — extract first item's title safely
      const lineItems = Array.isArray(o.lineItems) ? o.lineItems as Array<Record<string, unknown>> : []
      const firstTitle = lineItems.length > 0 ? str(lineItems[0]?.title) : ''
      const pricing = o.pricingSummary as Record<string, Record<string, string>> | undefined
      const totalValue = (pricing?.total?.value ?? str(o.total)) || '1.00'
      return {
        externalId: str(o.orderId ?? o.id) || String(Math.random()),
        title: str(o.title) || firstTitle || 'eBay Order',
        description: `eBay order ${str(o.orderId)}`,
        usdcAmount: str(totalValue) || '1.00',
        sourceMarketplace: 'ebay',
        rawData: o,
      }
    })
  },
}
