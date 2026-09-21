/**
 * Jumia Seller API adapter
 * Requires: apiKey, country (e.g. "ng", "ke", "gh", "eg", "ma", "cm", "ci", "tz", "ug", "za")
 * Jumia's REST API endpoint varies by country: https://sellercenter-api.<country>.jumia.com
 */
import type { MarketplaceAdapter, MarketplaceOrder } from './types'

const JUMIA_BASE = (country: string) =>
  `https://sellercenter-api.${country.toLowerCase()}.jumia.com`

function str(v: unknown, fallback = ''): string {
  if (v === null || v === undefined) return fallback
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return fallback
}

export const jumiaAdapter: MarketplaceAdapter = {
  id: 'jumia',
  name: 'Jumia',

  async test(apiKey: string, extra?: Record<string, string>): Promise<boolean> {
    const country = extra?.country ?? 'ng'
    try {
      const res = await fetch(`${JUMIA_BASE(country)}/v1/orders?limit=1&status=pending`, {
        headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
      })
      return res.ok
    } catch {
      try {
        const res = await fetch('/api/jumia/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey, country }),
        })
        return res.ok
      } catch {
        return false
      }
    }
  },

  async fetchOrders(apiKey: string, extra?: Record<string, string>): Promise<MarketplaceOrder[]> {
    const country = extra?.country ?? 'ng'
    let orders: Array<Record<string, unknown>> = []

    try {
      const res = await fetch(`${JUMIA_BASE(country)}/v1/orders?status=pending&limit=50`, {
        headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
      })
      if (!res.ok) throw new Error(`Jumia API error: ${res.status}`)
      const data = await res.json() as { data?: unknown[] }
      orders = (data.data ?? []) as Array<Record<string, unknown>>
    } catch {
      const res = await fetch('/api/jumia/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, country }),
      })
      if (!res.ok) throw new Error(`Jumia relay error: ${res.status}`)
      const data = await res.json() as { orders?: unknown[] }
      orders = (data.orders ?? []) as Array<Record<string, unknown>>
    }

    return orders.map((o) => ({
      externalId: str(o.order_id ?? o.id) || String(Math.random()),
      title: str(o.product_name ?? o.name) || 'Jumia Order',
      description: `Jumia order ${str(o.order_id)}`,
      usdcAmount: str(o.total_price ?? o.amount) || '1.00',
      sourceMarketplace: 'jumia',
      rawData: o,
    }))
  },
}
