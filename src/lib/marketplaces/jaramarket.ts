/**
 * Jaramarket.store adapter
 * Expects a REST API at <storeUrl>/api/orders?status=unfulfilled
 * with Bearer token auth and JSON response { orders: [...] }
 */
import type { MarketplaceAdapter, MarketplaceOrder } from './types'

function str(v: unknown, fallback = ''): string {
  if (v === null || v === undefined) return fallback
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return fallback
}

export const jaramarketAdapter: MarketplaceAdapter = {
  id: 'jaramarket',
  name: 'Jaramarket',

  async test(apiKey: string, extra?: Record<string, string>): Promise<boolean> {
    const storeUrl = extra?.storeUrl?.replace(/\/$/, '') ?? 'https://jaramarket.store'
    try {
      const res = await fetch(`${storeUrl}/api/orders?limit=1`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      return res.ok
    } catch {
      return false
    }
  },

  async fetchOrders(apiKey: string, extra?: Record<string, string>): Promise<MarketplaceOrder[]> {
    const storeUrl = extra?.storeUrl?.replace(/\/$/, '') ?? 'https://jaramarket.store'
    const res = await fetch(`${storeUrl}/api/orders?status=pending&limit=50`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) throw new Error(`Jaramarket API error: ${res.status}`)
    const data = await res.json() as { orders?: unknown[] }
    const orders = (data.orders ?? []) as Array<Record<string, unknown>>
    return orders.map((o) => ({
      externalId: str(o.id ?? o.order_id ?? o.orderId) || String(Math.random()),
      title: str(o.title ?? o.name ?? o.product_name) || 'Jaramarket Order',
      description: str(o.description ?? o.notes),
      usdcAmount: str(o.total ?? o.amount) || '1.00',
      sourceMarketplace: 'jaramarket',
      rawData: o,
    }))
  },
}
