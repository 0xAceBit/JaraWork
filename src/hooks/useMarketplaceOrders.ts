/**
 * Polls configured marketplace adapters for new orders
 * Returns orders ready to be posted on-chain by the admin/buyer
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import type { MarketplaceOrder, MarketplaceKeys } from '../lib/marketplaces/types'
import { getAdapter } from '../lib/marketplaces/registry'
import { loadMarketplaceKeys } from '../lib/marketplaces/storage'

const POLL_INTERVAL_MS = 60_000 // 60s

export interface MarketplaceFeed {
  orders: MarketplaceOrder[]
  loading: boolean
  error: string | null
  lastFetched: Date | null
  refresh: () => void
}

export function useMarketplaceOrders(): MarketplaceFeed {
  const [orders, setOrders] = useState<MarketplaceOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  const mounted = useRef(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    const keys: MarketplaceKeys = loadMarketplaceKeys()
    const all: MarketplaceOrder[] = []
    const errors: string[] = []

    const tasks: Promise<void>[] = []

    // Jaramarket
    if (keys.jaramarket) {
      const cfg = keys.jaramarket
      const adapter = getAdapter('jaramarket')
      if (adapter) {
        tasks.push(
          adapter.fetchOrders(cfg.apiKey, { storeUrl: cfg.storeUrl })
            .then((fetched) => { all.push(...fetched) })
            .catch((e: unknown) => { errors.push(`jaramarket: ${(e as Error).message}`) })
        )
      }
    }

    // Amazon
    if (keys.amazon) {
      const cfg = keys.amazon
      const adapter = getAdapter('amazon')
      if (adapter) {
        tasks.push(
          adapter.fetchOrders(cfg.accessKey, { sellerId: cfg.sellerId, marketplaceId: cfg.marketplaceId })
            .then((fetched) => { all.push(...fetched) })
            .catch((e: unknown) => { errors.push(`amazon: ${(e as Error).message}`) })
        )
      }
    }

    // eBay
    if (keys.ebay) {
      const cfg = keys.ebay
      const adapter = getAdapter('ebay')
      if (adapter) {
        tasks.push(
          adapter.fetchOrders(cfg.clientId, { clientSecret: cfg.clientSecret })
            .then((fetched) => { all.push(...fetched) })
            .catch((e: unknown) => { errors.push(`ebay: ${(e as Error).message}`) })
        )
      }
    }

    // Jumia
    if (keys.jumia) {
      const cfg = keys.jumia
      const adapter = getAdapter('jumia')
      if (adapter) {
        tasks.push(
          adapter.fetchOrders(cfg.apiKey, { country: cfg.country })
            .then((fetched) => { all.push(...fetched) })
            .catch((e: unknown) => { errors.push(`jumia: ${(e as Error).message}`) })
        )
      }
    }

    await Promise.all(tasks)

    if (mounted.current) {
      setOrders(all)
      setLastFetched(new Date())
      if (errors.length > 0) setError(errors.join('; '))
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    void fetchAll()
    const id = setInterval(() => { void fetchAll() }, POLL_INTERVAL_MS)
    return () => {
      mounted.current = false
      clearInterval(id)
    }
  }, [fetchAll])

  return { orders, loading, error, lastFetched, refresh: () => { void fetchAll() } }
}
