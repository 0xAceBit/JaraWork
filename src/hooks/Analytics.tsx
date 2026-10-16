/**
 * Analytics — retroactive on-chain platform stats for JaraWork
 * Reads all historical orders directly from the deployed Arc Mainnet contract.
 */
import { TokenUSDC } from '@web3icons/react'
import { RefreshCw, Loader2, TrendingUp, Users, ShoppingBag, CheckCircle, Zap, Clock } from 'lucide-react'
import { useAnalytics } from '../hooks/useAnalytics'
import { buildAddressExplorerUrl } from '../onchain-facts'
import { arc } from 'viem/chains'

const CHAIN_ID = arc.id

function StatCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-1.5"
      style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-2">
        <span style={{ color: 'var(--accent)' }}>{icon}</span>
        <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--muted)' }}>{label}</p>
      </div>
      <p className="display text-2xl font-bold" style={{ color: 'var(--ink)' }}>{value}</p>
      {sub && <p className="text-xs" style={{ color: 'var(--subtle)' }}>{sub}</p>}
    </div>
  )
}

function RateBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span style={{ color: 'var(--ink-2)' }}>{label}</span>
        <span className="font-semibold tabular" style={{ color: 'var(--ink)' }}>{value}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  )
}

const MARKETPLACE_LABELS: Record<string, string> = {
  jaramarket: 'Jaramarket',
  amazon: 'Amazon',
  ebay: 'eBay',
  jumia: 'Jumia',
  shopify: 'Shopify',
  manual: 'Manual',
}

export default function Analytics() {
  const stats = useAnalytics()

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="display font-bold text-lg" style={{ color: 'var(--ink)' }}>Platform Analytics</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            Live data pulled retroactively from Arc Mainnet contract
          </p>
        </div>
        <button
          onClick={() => { void stats.refresh() }}
          disabled={stats.loading}
          className="p-2 rounded-xl transition-colors"
          style={{ color: 'var(--muted)', background: 'var(--surface-muted)' }}
        >
          {stats.loading
            ? <Loader2 size={15} className="animate-spin" />
            : <RefreshCw size={15} />
          }
        </button>
      </div>

      {stats.error && (
        <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b' }}>
          Failed to load: {stats.error}
        </div>
      )}

      {stats.loading && stats.totalOrders === 0 && (
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Reading all orders from Arc Mainnet…</p>
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>This may take a few seconds</p>
        </div>
      )}

      {stats.totalOrders > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Orders" value={stats.totalOrders} sub="all time" icon={<ShoppingBag size={14} />} />
            <StatCard label="Total Volume" value={`$${stats.totalVolumeUsdc.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} sub="USDC locked" icon={<TokenUSDC variant="branded" size={14} />} />
            <StatCard label="Unique Buyers" value={stats.uniqueBuyers} sub="wallet addresses" icon={<Users size={14} />} />
            <StatCard label="Unique Workers" value={stats.uniqueWorkers} sub="wallet addresses" icon={<Zap size={14} />} />
            <StatCard label="Completed" value={`$${stats.completedVolumeUsdc.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} sub={`${stats.completedOrders} orders paid out`} icon={<CheckCircle size={14} />} />
            <StatCard label="Avg Order" value={`$${stats.avgOrderValueUsdc}`} sub="USDC per order" icon={<TrendingUp size={14} />} />
          </div>

          <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
            <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--muted)' }}>Order Status Breakdown</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Open', count: stats.openOrders, color: '#2563eb', bg: '#eff6ff' },
                { label: 'Claimed', count: stats.claimedOrders, color: '#b45309', bg: '#fffbeb' },
                { label: 'Delivered', count: stats.deliveredOrders, color: '#7c3aed', bg: '#f5f3ff' },
                { label: 'Completed', count: stats.completedOrders, color: '#15803d', bg: '#f0fdf4' },
                { label: 'Refunded', count: stats.refundedOrders, color: '#4b5563', bg: '#f9fafb' },
                { label: 'Disputed', count: stats.disputedOrders, color: '#dc2626', bg: '#fef2f2' },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-2.5 flex flex-col gap-0.5" style={{ background: s.bg, border: `1px solid ${s.color}22` }}>
                  <span className="text-lg font-bold tabular" style={{ color: s.color }}>{s.count}</span>
                  <span className="text-xs" style={{ color: s.color }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
            <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--muted)' }}>Rates</p>
            <RateBar label="Completion rate" value={stats.completionRate} color="#16a34a" />
            <RateBar label="Refund rate" value={stats.refundRate} color="#6b7280" />
            <RateBar label="Dispute rate" value={stats.disputeRate} color="#dc2626" />
          </div>

          {(stats.avgTimeToClaimHours !== null || stats.avgTimeToCompleteHours !== null) && (
            <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2">
                <Clock size={14} style={{ color: 'var(--accent)' }} />
                <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--muted)' }}>Average Timing</p>
              </div>
              <div className="flex flex-col gap-1 text-sm">
                {stats.avgTimeToClaimHours !== null && (
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--ink-2)' }}>Time to claim</span>
                    <span className="font-semibold tabular" style={{ color: 'var(--ink)' }}>
                      {stats.avgTimeToClaimHours < 1
                        ? `${Math.round(stats.avgTimeToClaimHours * 60)}m`
                        : `${stats.avgTimeToClaimHours}h`}
                    </span>
                  </div>
                )}
                {stats.avgTimeToCompleteHours !== null && (
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--ink-2)' }}>Time to complete</span>
                    <span className="font-semibold tabular" style={{ color: 'var(--ink)' }}>
                      {stats.avgTimeToCompleteHours < 24
                        ? `${stats.avgTimeToCompleteHours}h`
                        : `${Math.round(stats.avgTimeToCompleteHours / 24)}d`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {Object.keys(stats.byMarketplace).length > 0 && (
            <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
              <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--muted)' }}>Orders by Marketplace</p>
              <div className="flex flex-col gap-2">
                {Object.entries(stats.byMarketplace)
                  .sort(([, a], [, b]) => b - a)
                  .map(([id, count]) => (
                    <div key={id} className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: 'var(--ink-2)' }}>{MARKETPLACE_LABELS[id] ?? id}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 rounded-full" style={{ width: `${Math.round((count / stats.totalOrders) * 80)}px`, background: 'var(--accent)', opacity: 0.6 }} />
                        <span className="text-sm font-semibold tabular" style={{ color: 'var(--ink)' }}>{count}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {stats.topWorkers.length > 0 && (
            <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
              <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--muted)' }}>Top Workers</p>
              <div className="flex flex-col gap-2">
                {stats.topWorkers.map((w, i) => (
                  <div key={w.address} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: i === 0 ? '#fbbf24' : i === 1 ? '#d1d5db' : i === 2 ? '#d97706' : 'var(--surface-strong)', color: i < 3 ? '#fff' : 'var(--muted)' }}>{i + 1}</span>
                    <a href={buildAddressExplorerUrl(CHAIN_ID, w.address)} target="_blank" rel="noopener" className="mono text-xs underline truncate flex-1" style={{ color: 'var(--accent-hover)' }}>{w.address.slice(0, 6)}…{w.address.slice(-4)}</a>
                    <div className="flex items-center gap-1 shrink-0">
                      <TokenUSDC variant="branded" size={12} />
                      <span className="text-xs font-semibold tabular" style={{ color: 'var(--ink)' }}>{w.earnedUsdc.toFixed(2)}</span>
                    </div>
                    <span className="text-xs shrink-0" style={{ color: 'var(--muted)' }}>{w.completedCount} order{w.completedCount !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.ordersOverTime.length > 1 && (
            <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
              <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--muted)' }}>Orders Over Time</p>
              <div className="flex items-end gap-1 h-16">
                {stats.ordersOverTime.map(({ date, count }) => {
                  const max = Math.max(...stats.ordersOverTime.map(d => d.count))
                  const pct = max > 0 ? (count / max) * 100 : 0
                  return (
                    <div key={date} className="flex-1 flex flex-col items-center gap-1 group relative" title={`${date}: ${count}`}>
                      <div className="w-full rounded-t-sm transition-all" style={{ height: `${Math.max(pct, 4)}%`, background: 'var(--accent)', opacity: 0.7 }} />
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between text-xs" style={{ color: 'var(--subtle)' }}>
                <span>{stats.ordersOverTime[0]?.date}</span>
                <span>{stats.ordersOverTime[stats.ordersOverTime.length - 1]?.date}</span>
              </div>
            </div>
          )}

          {stats.lastFetched && (
            <p className="text-xs text-center" style={{ color: 'var(--subtle)' }}>
              Last updated {new Date(stats.lastFetched).toLocaleTimeString()}
            </p>
          )}
        </>
      )}
    </div>
  )
}
