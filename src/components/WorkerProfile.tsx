/**
 * WorkerProfile — clickable worker address that opens a modal showing
 * on-chain reputation stats derived from JaraWorkEscrow order history.
 *
 * Usage:
 *   <WorkerAddress address={order.worker} />
 */
import { useState } from 'react'
import { formatUnits } from 'viem'
import { X, Star, Shield, Zap, Award, TrendingUp, Package, CheckCircle, AlertCircle, Clock, ExternalLink, Loader2 } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { useWorkerReputation, type WorkerReputation } from '../hooks/useEscrow'
import { buildAddressExplorerUrl } from '../onchain-facts'
import { arcTestnet } from 'viem/chains'

const CHAIN_ID = arcTestnet.id

// ─── Deterministic colour avatar from address ──────────────────────────────────

function AddressAvatar({ address, size = 40 }: { address: string; size?: number }) {
  const hue = parseInt(address.slice(2, 8), 16) % 360
  const hue2 = (hue + 40) % 360
  const letter = address.slice(2, 4).toUpperCase()
  return (
    <div
      style={{
        width: size, height: size, borderRadius: size / 3,
        background: `linear-gradient(135deg, hsl(${hue},70%,55%), hsl(${hue2},70%,45%))`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', fontWeight: 700,
        fontSize: size * 0.36, color: '#fff',
        flexShrink: 0,
        boxShadow: `0 2px 12px hsl(${hue},60%,50%,0.35)`,
      }}
    >
      {letter}
    </div>
  )
}

// ─── Level badge ───────────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<WorkerReputation['level'], { icon: React.ReactNode; bg: string; text: string }> = {
  Newcomer: { icon: <Clock size={11} />,      bg: 'rgba(120,120,120,0.12)', text: '#666' },
  Reliable: { icon: <TrendingUp size={11} />, bg: 'rgba(37,99,235,0.12)',   text: '#1d4ed8' },
  Trusted:  { icon: <Shield size={11} />,     bg: 'rgba(5,150,105,0.12)',   text: '#047857' },
  Expert:   { icon: <Star size={11} />,       bg: 'rgba(217,119,6,0.12)',   text: '#b45309' },
  Elite:    { icon: <Award size={11} />,      bg: 'rgba(124,58,237,0.12)',  text: '#6d28d9' },
}

function LevelBadge({ level }: { level: WorkerReputation['level'] }) {
  const cfg = LEVEL_CONFIG[level]
  return (
    <span
      className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
      style={{ background: cfg.bg, color: cfg.text }}
    >
      {cfg.icon}
      {level}
    </span>
  )
}

// ─── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 28, circ = 2 * Math.PI * r
  const filled = (score / 100) * circ
  const color = score >= 75 ? '#059669' : score >= 45 ? '#d97706' : '#dc2626'
  return (
    <svg width={72} height={72} viewBox="0 0 72 72">
      <circle cx={36} cy={36} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={6} />
      <circle
        cx={36} cy={36} r={r} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x={36} y={40} textAnchor="middle" fontSize={16} fontWeight={700} fill={color} fontFamily="var(--font-display)">
        {score}
      </text>
    </svg>
  )
}

// ─── Modal ─────────────────────────────────────────────────────────────────────

function WorkerProfileModal({ address, onClose }: { address: `0x${string}`; onClose: () => void }) {
  const { reputation, isLoading } = useWorkerReputation(address)

  const shortAddr = `${address.slice(0, 8)}…${address.slice(-6)}`

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(20,12,5,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      {/* Sheet */}
      <div
        className="relative w-full max-w-sm rounded-3xl overflow-hidden"
        style={{
          background: '#fffaf5',
          boxShadow: '0 24px 80px rgba(160,100,30,0.22)',
          border: '1px solid rgba(232,112,10,0.12)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top amber strip */}
        <div style={{ height: 4, background: 'linear-gradient(90deg, #e8700a, #f5a95c, #e8700a)' }} />

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl transition-colors"
          style={{ background: 'var(--surface-muted)', color: 'var(--muted)' }}
        >
          <X size={16} />
        </button>

        <div className="px-6 pt-5 pb-6 flex flex-col gap-5">

          {/* Identity row */}
          <div className="flex items-center gap-3">
            <AddressAvatar address={address} size={48} />
            <div className="flex-1 min-w-0">
              <p className="display font-bold text-sm" style={{ color: 'var(--ink)' }}>Worker</p>
              <p className="mono text-xs truncate" style={{ color: 'var(--muted)' }}>{shortAddr}</p>
              <a
                href={buildAddressExplorerUrl(CHAIN_ID, address)}
                target="_blank" rel="noopener"
                className="flex items-center gap-0.5 text-xs underline mt-0.5"
                style={{ color: 'var(--accent-hover)' }}
              >
                <ExternalLink size={10} />
                View on explorer
              </a>
            </div>
            {reputation && !isLoading && (
              <LevelBadge level={reputation.level} />
            )}
          </div>

          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-8" style={{ color: 'var(--muted)' }}>
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading reputation…</span>
            </div>
          )}

          {!isLoading && reputation && (
            <>
              {/* Score + stats */}
              <div
                className="rounded-2xl p-4 flex items-center gap-4"
                style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
              >
                <ScoreRing score={reputation.score} />
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: 'var(--muted)' }}>
                    Reputation Score
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span style={{ color: 'var(--ink-2)' }}>Completion rate</span>
                    <span className="font-bold tabular" style={{ color: reputation.completionRate >= 80 ? 'var(--success)' : 'var(--accent)' }}>
                      {reputation.totalOrders === 0 ? '—' : `${reputation.completionRate}%`}
                    </span>
                    <span style={{ color: 'var(--ink-2)' }}>Total orders</span>
                    <span className="font-bold tabular" style={{ color: 'var(--ink)' }}>{reputation.totalOrders}</span>
                  </div>
                </div>
              </div>

              {/* Stat grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: <CheckCircle size={14} style={{ color: '#059669' }} />, label: 'Completed', value: reputation.completed, color: '#059669' },
                  { icon: <Package size={14} style={{ color: 'var(--accent)' }} />, label: 'In Progress', value: reputation.inProgress, color: 'var(--accent)' },
                  { icon: <AlertCircle size={14} style={{ color: '#dc2626' }} />, label: 'Disputed', value: reputation.disputed, color: '#dc2626' },
                  { icon: <Zap size={14} style={{ color: '#7c3aed' }} />, label: 'USDC Earned', value: `$${parseFloat(formatUnits(reputation.totalEarned, 6)).toFixed(0)}`, color: '#7c3aed' },
                ].map(s => (
                  <div
                    key={s.label}
                    className="rounded-2xl p-3.5 flex flex-col gap-1.5"
                    style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center gap-1.5">
                      {s.icon}
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>{s.label}</span>
                    </div>
                    <span className="display font-bold text-xl tabular" style={{ color: s.color, letterSpacing: '-0.02em' }}>
                      {s.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* USDC earned highlight */}
              {reputation.totalEarned > 0n && (
                <div
                  className="rounded-2xl px-4 py-3 flex items-center gap-3"
                  style={{ background: 'linear-gradient(145deg,#fff3e0,#ffe0b2)', border: '1px solid rgba(232,112,10,0.18)' }}
                >
                  <TokenUSDC variant="branded" size={22} />
                  <div>
                    <p className="text-xs" style={{ color: 'var(--accent-text)' }}>Total USDC earned on JaraWork</p>
                    <p className="display font-bold text-lg tabular" style={{ color: 'var(--accent)', letterSpacing: '-0.02em' }}>
                      {parseFloat(formatUnits(reputation.totalEarned, 6)).toFixed(2)} USDC
                    </p>
                  </div>
                </div>
              )}

              {/* New worker message */}
              {reputation.totalOrders === 0 && (
                <div
                  className="rounded-2xl px-4 py-3 text-sm text-center"
                  style={{ background: 'var(--surface-muted)', border: '1px dashed var(--border)', color: 'var(--muted)' }}
                >
                  This worker hasn't completed any orders yet.
                </div>
              )}
            </>
          )}

          {!isLoading && !reputation && (
            <p className="text-sm text-center py-6" style={{ color: 'var(--muted)' }}>
              Could not load reputation data.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Public component — clickable worker address ───────────────────────────────

interface WorkerAddressProps {
  address: string
  showYou?: boolean
  isYou?: boolean
}

export default function WorkerAddress({ address, showYou, isYou }: WorkerAddressProps) {
  const [open, setOpen] = useState(false)

  if (!address || address === '0x0000000000000000000000000000000000000000') return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 group"
        title="View worker profile"
      >
        <AddressAvatar address={address} size={18} />
        <span
          className="mono text-xs underline-offset-2 group-hover:underline"
          style={{ color: 'var(--accent-hover)' }}
        >
          {address.slice(0, 6)}…{address.slice(-4)}
        </span>
        {showYou && isYou && (
          <span
            className="font-bold px-1.5 py-0.5 rounded-full text-xs"
            style={{ background: 'rgba(26,110,60,0.12)', color: 'var(--success)' }}
          >
            you
          </span>
        )}
      </button>

      {open && (
        <WorkerProfileModal
          address={address as `0x${string}`}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
