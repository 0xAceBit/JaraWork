/**
 * Shopify marketplace adapter
 *
 * OAuth flow (handled server-side):
 *   1. User clicks "Connect Shopify" → GET /api/shopify/install?shop=mystore.myshopify.com
 *   2. Server redirects to Shopify OAuth consent page
 *   3. Shopify redirects to GET /api/shopify/callback?shop=...&code=...
 *   4. Server exchanges code for access_token, stores it, returns to frontend
 *
 * fetchOrders uses the stored access_token via /api/shopify/orders?shop=...
 */
import type { MarketplaceAdapter, MarketplaceOrder } from './types'

export const shopifyAdapter: MarketplaceAdapter = {
  id: 'shopify',
  name: 'Shopify',

  async test(_apiKey: string, extra?: Record<string, string>): Promise<boolean> {
    const shop = extra?.shop ?? ''
    if (!shop) return false
    try {
      const res = await fetch(`/api/shopify/ping?shop=${encodeURIComponent(shop)}`)
      return res.ok
    } catch {
      return false
    }
  },

  async fetchOrders(_apiKey: string, extra?: Record<string, string>): Promise<MarketplaceOrder[]> {
    const shop = extra?.shop ?? ''
    if (!shop) return []
    try {
      const res = await fetch(`/api/shopify/orders?shop=${encodeURIComponent(shop)}`)
      if (!res.ok) return []
      const data = await res.json() as { orders?: ShopifyOrder[] }
      return (data.orders ?? []).map(mapShopifyOrder)
    } catch {
      return []
    }
  },
}

interface ShopifyOrder {
  id: number
  name: string
  line_items: Array<{ title: string; quantity: number; price: string }>
  total_price: string
  currency: string
  created_at: string
  financial_status: string
  fulfillment_status: string | null
}

function mapShopifyOrder(o: ShopifyOrder): MarketplaceOrder {
  const titles = o.line_items.map(li => `${li.title}${li.quantity > 1 ? ` x${li.quantity}` : ''}`).join(', ')
  return {
    externalId:        `shopify-${o.id}`,
    title:             titles || o.name,
    description:       `Shopify order ${o.name} — ${o.line_items.length} item(s)`,
    usdcAmount:        o.total_price,
    sourceMarketplace: 'shopify',
    rawData:           o as unknown as Record<string, unknown>,
  }
}
