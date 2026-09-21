/**
 * Amazon SP-API adapter (seller orders)
 * Requires: accessKey, secretKey, sellerId, marketplaceId
 * The SP-API requires server-side signing (SigV4) — this client-side adapter
 * works only if the user has a proxy/relay that handles auth forwarding.
 *
 * For production, configure a lightweight server relay that signs requests
 * and expose it at /api/amazon/orders — this adapter will route to that.
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
      const res = await fetch('/api/amazon/ping', { method: 'GET' })
      return res.ok
    } catch {
      return false
    }
  },

  async fetchOrders(apiKey: string, extra?: Record<string, string>): Promise<MarketplaceOrder[]> {
    const params = new URLSearchParams({
      accessKey: apiKey,
      sellerId: extra?.sellerId ?? '',
      marketplaceId: extra?.marketplaceId ?? 'ATVPDKIKX0DER',
    })
    const res = await fetch(`/api/amazon/orders?${params}`)
    if (!res.ok) throw new Error(`Amazon relay error: ${res.status}`)
    const data = await res.json() as { orders?: unknown[] }
    const orders = (data.orders ?? []) as Array<Record<string, unknown>>
    return orders.map((o) => {
      const orderTotal = o.OrderTotal as Record<string, string> | undefined
      const usdcAmount = str(orderTotal?.Amount ?? o.total) || '1.00'
      return {
        externalId: str(o.AmazonOrderId ?? o.id) || String(Math.random()),
        title: str(o.Title ?? o.title) || 'Amazon Order',
        description: `Amazon order ${str(o.AmazonOrderId)}`,
        usdcAmount,
        sourceMarketplace: 'amazon',
        rawData: o,
      }
    })
  },
}
