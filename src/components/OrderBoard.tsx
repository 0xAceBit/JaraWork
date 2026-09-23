import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAccount } from 'wagmi'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, ShoppingBag, Loader2, ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import {
  useOpenOrdersPaginated, ORDERS_PAGE_SIZE,
  useOrder, useClaimOrder,
  useSubmitDelivery, useConfirmDelivery,
  useRefundOrder, useDisputeOrder, parseOrderStruct,
} from '../hooks/useEscrow'
import OrderCard from './OrderCard'
import DeliveryModal from './DeliveryModal'
import { buildTxExplorerUrl } from '../onchain-facts'
import { MARKETPLACE_LABELS } from '../contracts/jaraWorkEscrow'
import type { Order } from '../contracts/jaraWorkEscrow'
import { arcTestnet } from 'viem/chains'

// ─── Filter state ────────────────────────────────────────────────────────────

interface FilterState {
  marketplace: string   // '' = all
  minAmount: string     // '' = no min
  maxAmount: string     // '' = no max
  sort: 'newest' | 'oldest' | 'amount_asc' | 'amount_desc'
}

const DEFAULT_FILTERS: FilterState = {
  marketplace: '',
  minAmount: '',
  maxAmount: '',
  sort: 'newest',
}

function hasActiveFilters(f: FilterState) {
  return f.marketplace !== '' || f.minAmount !== '' || f.maxAmount !== '' || f.sort !== 'newest'
}

// ─── SingleOrder: renders one card and reports its parsed Order up ────────────

function SingleOrder({
  orderKey, connectedAddress,
  onClaimSuccess, onDeliverySuccess, onConfirmSuccess, onRefundSuccess,
  onOrderParsed,
}: {
  orderKey: `0x${string}`
  connectedAddress?: string
  onClaimSuccess: () => void
  onDeliverySuccess: () => void
  onConfirmSuccess: () => void
  onRefundSuccess: () => void
  onOrderParsed?: (key: string, order: Order | null) => void
}) {
  const { data: rawOrder, refetch } = useOrder(orderKey)
  const { claim, isPending: claiming, isConfirming: claimConfirming, isSuccess: claimSuccess, error: claimError, hash: claimHash } = useClaimOrder()
  const { submit, isPending: submitting, isConfirming: submitConfirming, isSuccess: submitSuccess, hash: submitHash } = useSubmitDelivery()
  const { confirm, isPending: _confirming, isConfirming: _confirmConfirming, isSuccess: confirmSuccess, hash: confirmHash } = useConfirmDelivery()
  const { refund, isPending: _refunding, isConfirming: _refundConfirming, isSuccess: refundSuccess, hash: refundHash } = useRefundOrder()
  const { dispute } = useDisputeOrder()
  const [showDeliveryModal, setShowDeliveryModal] = useState(false)

  // Report parsed order data upward for filtering
  useEffect(() => {
    if (!rawOrder) { onOrderParsed?.(orderKey, null); return }
    onOrderParsed?.(orderKey, parseOrderStruct(rawOrder))
  }, [rawOrder, orderKey, onOrderParsed])

  useEffect(() => {
    if (claimSuccess) {
      toast.success('Order claimed!', { description: claimHash ? <a href={buildTxExplorerUrl(arcTestnet.id, claimHash)} target="_blank" rel="noopener" className="underline">View on explorer</a> : undefined })
      void refetch()
      onClaimSuccess()
    }
  }, [claimSuccess, claimHash, refetch, onClaimSuccess])

  useEffect(() => {
    if (claimError) toast.error('Claim failed', { description: (claimError as Error).message })
  }, [claimError])

  useEffect(() => {
    if (submitSuccess) {
      toast.success('Delivery submitted!', { description: submitHash ? <a href={buildTxExplorerUrl(arcTestnet.id, submitHash)} target="_blank" rel="noopener" className="underline">View on explorer</a> : undefined })
      void refetch()
      setShowDeliveryModal(false)
      onDeliverySuccess()
    }
  }, [submitSuccess, submitHash, refetch, onDeliverySuccess])

  useEffect(() => {
    if (confirmSuccess) {
      toast.success('Payment released to worker!', { description: confirmHash ? <a href={buildTxExplorerUrl(arcTestnet.id, confirmHash)} target="_blank" rel="noopener" className="underline">View on explorer</a> : undefined })
      void refetch()
      onConfirmSuccess()
    }
  }, [confirmSuccess, confirmHash, refetch, onConfirmSuccess])

  useEffect(() => {
    if (refundSuccess) {
      toast.success('Refund sent!', { description: refundHash ? <a href={buildTxExplorerUrl(arcTestnet.id, refundHash)} target="_blank" rel="noopener" className="underline">View on explorer</a> : undefined })
      void refetch()
      onRefundSuccess()
    }
  }, [refundSuccess, refundHash, refetch, onRefundSuccess])

  if (!rawOrder) return null
  const order = parseOrderStruct(rawOrder)

  return (
    <>
      <OrderCard
        orderKey={orderKey}
        order={order}
        connectedAddress={connectedAddress}
        onClaim={claim}
        isClaiming={claiming || claimConfirming}
        onSubmitDelivery={() => setShowDeliveryModal(true)}
        onConfirmDelivery={confirm}
        onRefund={refund}
        onDispute={dispute}
      />
      {showDeliveryModal && (
        <DeliveryModal
          orderTitle={order.title}
          onSubmit={(proof) => submit(orderKey, proof)}
          onClose={() => setShowDeliveryModal(false)}
          isPending={submitting}
          isConfirming={submitConfirming}
        />
      )}
    </>
  )
}

// ─── Paginated key accumulator ────────────────────────────────────────────────

function useAccumulatedOpenOrders() {
  const [pages, setPages] = useState(1)
  const [allKeys, setAllKeys] = useState<`0x${string}`[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [refreshSeed, setRefreshSeed] = useState(0)

  const offset = (pages - 1) * ORDERS_PAGE_SIZE
  const { data, isLoading, refetch } = useOpenOrdersPaginated(offset)

  useEffect(() => {
    if (!data) return
    const [keys, tot] = data as readonly [`0x${string}`[], bigint]
    const newKeys = Array.from(keys)
    setTotal(Number(tot))
    setAllKeys(prev => {
      if (pages === 1) return newKeys
      const existing = new Set(prev.map(k => k.toLowerCase()))
      const added = newKeys.filter(k => !existing.has(k.toLowerCase()))
      return [...prev, ...added]
    })
  }, [data, pages])

  useEffect(() => {
    if (refreshSeed === 0) return
    setPages(1)
    setAllKeys([])
    void refetch()
  }, [refreshSeed, refetch])

  const loadMore = useCallback(() => setPages(p => p + 1), [])
  const refresh  = useCallback(() => setRefreshSeed(s => s + 1), [])
  const hasMore  = total !== null && allKeys.length < total

  return { allKeys, total, isLoading, hasMore, loadMore, refresh }
}

// ─── FilterBar ────────────────────────────────────────────────────────────────

const SORT_LABELS: Record<FilterState['sort'], string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  amount_asc: 'Lowest amount',
  amount_desc: 'Highest amount',
}

function FilterBar({
  filters, onChange, resultCount, totalLoaded,
}: {
  filters: FilterState
  onChange: (f: FilterState) => void
  resultCount: number
  totalLoaded: number
}) {
  const [open, setOpen] = useState(false)
  const active = hasActiveFilters(filters)
  const marketplaces = Object.entries(MARKETPLACE_LABELS)

  function reset() { onChange(DEFAULT_FILTERS) }

  return (
    <div className="flex flex-col gap-2">
      {/* Toggle row */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all active:scale-95"
          style={{
            background: active ? 'var(--accent)' : 'var(--surface-strong)',
            border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
            color: active ? '#fff' : 'var(--ink-2)',
          }}
        >
          <SlidersHorizontal size={12} />
          Filter{active ? ' (active)' : ''}
        </button>

        {/* Active filter chips */}
        {filters.marketplace && (
          <span
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full cursor-pointer"
            style={{ background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid rgba(232,112,10,0.2)' }}
            onClick={() => onChange({ ...filters, marketplace: '' })}
          >
            {MARKETPLACE_LABELS[filters.marketplace] ?? filters.marketplace}
            <X size={10} />
          </span>
        )}
        {(filters.minAmount || filters.maxAmount) && (
          <span
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full cursor-pointer"
            style={{ background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid rgba(232,112,10,0.2)' }}
            onClick={() => onChange({ ...filters, minAmount: '', maxAmount: '' })}
          >
            {filters.minAmount && !filters.maxAmount ? `≥ $${filters.minAmount}` :
             !filters.minAmount && filters.maxAmount ? `≤ $${filters.maxAmount}` :
             `$${filters.minAmount}–$${filters.maxAmount}`}
            <X size={10} />
          </span>
        )}
        {filters.sort !== 'newest' && (
          <span
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full cursor-pointer"
            style={{ background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid rgba(232,112,10,0.2)' }}
            onClick={() => onChange({ ...filters, sort: 'newest' })}
          >
            {SORT_LABELS[filters.sort]}
            <X size={10} />
          </span>
        )}
        {active && (
          <button
            onClick={reset}
            className="ml-auto text-xs font-medium"
            style={{ color: 'var(--muted)' }}
          >
            Clear all
          </button>
        )}

        {/* Result count when filtered */}
        {active && (
          <span className="text-xs" style={{ color: 'var(--subtle)' }}>
            {resultCount} of {totalLoaded}
          </span>
        )}
      </div>

      {/* Expanded filter panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="filter-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div
              className="rounded-2xl p-4 flex flex-col gap-4"
              style={{
                background: 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(232,112,10,0.12)',
                boxShadow: '0 4px 20px rgba(160,100,30,0.07)',
              }}
            >
              {/* Marketplace pills */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>Marketplace</p>
                <div className="flex flex-wrap gap-2">
                  {[['', 'All'], ...marketplaces].map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => onChange({ ...filters, marketplace: id })}
                      className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-all active:scale-95"
                      style={{
                        background: filters.marketplace === id ? 'var(--accent)' : 'var(--surface-muted)',
                        color: filters.marketplace === id ? '#fff' : 'var(--ink-2)',
                        border: `1px solid ${filters.marketplace === id ? 'var(--accent)' : 'var(--border)'}`,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount range */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>Amount (USDC)</p>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium pointer-events-none" style={{ color: 'var(--muted)' }}>$</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="Min"
                      value={filters.minAmount}
                      onChange={e => onChange({ ...filters, minAmount: e.target.value })}
                      className="w-full pl-6 pr-3 py-2 rounded-xl text-sm outline-none"
                      style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                    />
                  </div>
                  <span className="text-xs" style={{ color: 'var(--subtle)' }}>to</span>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium pointer-events-none" style={{ color: 'var(--muted)' }}>$</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="Max"
                      value={filters.maxAmount}
                      onChange={e => onChange({ ...filters, maxAmount: e.target.value })}
                      className="w-full pl-6 pr-3 py-2 rounded-xl text-sm outline-none"
                      style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                    />
                  </div>
                </div>
              </div>

              {/* Sort */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>Sort by</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(SORT_LABELS) as [FilterState['sort'], string][]).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => onChange({ ...filters, sort: val })}
                      className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-all active:scale-95"
                      style={{
                        background: filters.sort === val ? 'var(--accent)' : 'var(--surface-muted)',
                        color: filters.sort === val ? '#fff' : 'var(--ink-2)',
                        border: `1px solid ${filters.sort === val ? 'var(--accent)' : 'var(--border)'}`,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setOpen(false)}
                className="self-end text-xs font-semibold px-4 py-1.5 rounded-xl"
                style={{ background: 'var(--surface-strong)', color: 'var(--ink-2)', border: '1px solid var(--border)' }}
              >
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── OrderBoard ───────────────────────────────────────────────────────────────

interface Props {
  statusFilter?: number | null
  buyerFilter?: `0x${string}`
  workerFilter?: `0x${string}`
  externalRefreshSeed?: number
}

export default function OrderBoard({ statusFilter: _statusFilter, buyerFilter: _buyerFilter, workerFilter: _workerFilter, externalRefreshSeed }: Props) {
  const { address } = useAccount()
  const { allKeys, total, isLoading, hasMore, loadMore, refresh } = useAccumulatedOpenOrders()
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [cardRevision, setCardRevision] = useState(0)
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const prevSeedRef = useState(externalRefreshSeed ?? 0)

  // Trigger refresh when parent increments the seed (e.g. after posting a new order)
  useEffect(() => {
    if (externalRefreshSeed !== undefined && externalRefreshSeed !== prevSeedRef[0]) {
      prevSeedRef[1](externalRefreshSeed)
      void refresh()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalRefreshSeed])

  // Map of orderKey → parsed Order (populated as cards render)
  const [orderDataMap, setOrderDataMap] = useState<Map<string, Order | null>>(new Map())

  const handleOrderParsed = useCallback((key: string, order: Order | null) => {
    setOrderDataMap(prev => {
      const next = new Map(prev)
      next.set(key, order)
      return next
    })
  }, [])

  // Filtered + sorted key list
  const filteredKeys = useMemo(() => {
    let keys = allKeys.slice()

    // Apply marketplace filter
    if (filters.marketplace) {
      keys = keys.filter(k => {
        const o = orderDataMap.get(k)
        return o?.sourceMarketplace === filters.marketplace
      })
    }

    // Apply amount range (USDC, 6 decimals on-chain)
    const minRaw = filters.minAmount ? BigInt(Math.round(parseFloat(filters.minAmount) * 1_000_000)) : null
    const maxRaw = filters.maxAmount ? BigInt(Math.round(parseFloat(filters.maxAmount) * 1_000_000)) : null
    if (minRaw !== null || maxRaw !== null) {
      keys = keys.filter(k => {
        const o = orderDataMap.get(k)
        if (!o) return true  // keep unloaded cards (can't filter yet)
        if (minRaw !== null && o.amount < minRaw) return false
        if (maxRaw !== null && o.amount > maxRaw) return false
        return true
      })
    }

    // Apply sort
    if (filters.sort !== 'newest') {
      keys = keys.slice().sort((a, b) => {
        const oa = orderDataMap.get(a)
        const ob = orderDataMap.get(b)
        if (!oa || !ob) return 0
        if (filters.sort === 'oldest') return Number(oa.createdAt - ob.createdAt)
        if (filters.sort === 'amount_asc') return Number(oa.amount - ob.amount)
        if (filters.sort === 'amount_desc') return Number(ob.amount - oa.amount)
        return 0
      })
    }

    return keys
  }, [allKeys, orderDataMap, filters])

  async function handleRefresh() {
    setRefreshing(true)
    refresh()
    await new Promise(r => setTimeout(r, 800))
    setRefreshing(false)
  }

  async function handleLoadMore() {
    setLoadingMore(true)
    loadMore()
    await new Promise(r => setTimeout(r, 600))
    setLoadingMore(false)
  }

  function onOrderMutated() {
    setCardRevision(v => v + 1)
    refresh()
  }

  const showCount = total !== null ? total : allKeys.length
  const active = hasActiveFilters(filters)

  return (
    <div className="flex flex-col gap-4">

      {/* Stats bar */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-center justify-between rounded-2xl px-4 py-3"
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(232,112,10,0.10)',
          boxShadow: '0 4px 16px rgba(160,100,30,0.06)',
        }}
      >
        <div className="flex items-center gap-1.5">
          {isLoading && allKeys.length === 0
            ? <Loader2 size={14} className="animate-spin" style={{ color: 'var(--muted)' }} />
            : (
              <>
                <TokenUSDC variant="branded" size={18} />
                <span className="display font-bold text-lg tabular" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
                  {active ? filteredKeys.length : showCount}
                </span>
                <span className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
                  {active ? `of ${showCount} order${showCount !== 1 ? 's' : ''}` : `open order${showCount !== 1 ? 's' : ''}`}
                </span>
              </>
            )
          }
        </div>
        <button
          onClick={() => { void handleRefresh() }}
          disabled={refreshing || isLoading}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all active:scale-95"
          style={{
            background: 'var(--accent-light)',
            border: '1px solid rgba(232,112,10,0.18)',
            color: 'var(--accent)',
          }}
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </motion.div>

      {/* Filter bar */}
      <FilterBar
        filters={filters}
        onChange={setFilters}
        resultCount={filteredKeys.length}
        totalLoaded={allKeys.length}
      />

      {/* Loading skeleton */}
      {isLoading && allKeys.length === 0 && (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-2xl h-36 animate-pulse" style={{ background: 'var(--surface-muted)' }} />
          ))}
        </div>
      )}

      {/* Empty state — no orders at all */}
      {!isLoading && allKeys.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col items-center justify-center gap-3 py-16 rounded-2xl"
          style={{ background: 'var(--surface-muted)', border: '1px dashed var(--border)' }}
        >
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
            <ShoppingBag size={22} style={{ color: 'var(--subtle)' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>No open orders right now</p>
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>The agent will post orders here automatically.</p>
        </motion.div>
      )}

      {/* Empty state — orders exist but filter hides them all */}
      {!isLoading && allKeys.length > 0 && filteredKeys.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col items-center justify-center gap-3 py-12 rounded-2xl"
          style={{ background: 'var(--surface-muted)', border: '1px dashed var(--border)' }}
        >
          <SlidersHorizontal size={22} style={{ color: 'var(--subtle)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>No orders match your filters</p>
          <button
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="text-xs font-semibold px-4 py-1.5 rounded-xl"
            style={{ background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid rgba(232,112,10,0.2)' }}
          >
            Clear filters
          </button>
        </motion.div>
      )}

      {/* All cards rendered (but filtered ones hidden via display:none to preserve wagmi cache) */}
      <div className="flex flex-col gap-3" key={cardRevision}>
        {allKeys.map((key, i) => {
          const visible = filteredKeys.includes(key)
          return (
            <div key={key} style={{ display: visible ? 'block' : 'none' }}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(i, 4) * 0.05, ease: [0.25, 0.1, 0.25, 1.0] }}
              >
                <SingleOrder
                  orderKey={key}
                  connectedAddress={address}
                  onClaimSuccess={onOrderMutated}
                  onDeliverySuccess={onOrderMutated}
                  onConfirmSuccess={onOrderMutated}
                  onRefundSuccess={onOrderMutated}
                  onOrderParsed={handleOrderParsed}
                />
              </motion.div>
            </div>
          )
        })}
      </div>

      {/* Load More */}
      {hasMore && (
        <button
          onClick={() => { void handleLoadMore() }}
          disabled={loadingMore || isLoading}
          className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-60"
          style={{
            background: 'var(--accent-light)',
            border: '1px solid rgba(232,112,10,0.20)',
            color: 'var(--accent)',
          }}
        >
          {loadingMore
            ? <><Loader2 size={14} className="animate-spin" /> Loading…</>
            : <><ChevronDown size={14} /> Load {Math.min(ORDERS_PAGE_SIZE, (total ?? 0) - allKeys.length)} more orders</>
          }
        </button>
      )}

    </div>
  )
}
