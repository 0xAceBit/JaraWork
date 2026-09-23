import { formatUnits } from 'viem'
import { Clock, User, CheckCircle, AlertCircle, ArrowRight, Package, Link2, Hash, FileText } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import {
  ORDER_STATUS_LABELS,
  MARKETPLACE_LABELS,
  MARKETPLACE_COLORS,
  type Order,
} from '../contracts/jaraWorkEscrow'
import WorkerAddress from './WorkerProfile'
import { parseDeliveryProof, type ProofType } from './DeliveryModal'

const PROOF_ICONS: Record<ProofType, React.ReactNode> = {
  tracking: <Package size={11} />,
  url:      <Link2 size={11} />,
  ipfs:     <Hash size={11} />,
  text:     <FileText size={11} />,
}

const PROOF_TYPE_LABELS: Record<ProofType, string> = {
  tracking: 'Tracking',
  url:      'Link',
  ipfs:     'IPFS',
  text:     'Note',
}

function ProofBadge({ raw }: { raw: string }) {
  const proof = parseDeliveryProof(raw)
  if (!proof) return (
    <div className="flex items-center gap-1.5">
      <CheckCircle size={11} style={{ color: 'var(--success)' }} />
      <span className="truncate">{raw.slice(0, 42)}{raw.length > 42 ? '…' : ''}</span>
    </div>
  )

  const icon  = PROOF_ICONS[proof.type]
  const label = PROOF_TYPE_LABELS[proof.type]

  // For URL: show as clickable link
  if (proof.type === 'url') {
    return (
      <div className="flex items-center gap-1.5">
        <CheckCircle size={11} style={{ color: 'var(--success)', flexShrink: 0 }} />
        <span style={{ color: 'var(--success)', flexShrink: 0 }}>{icon}</span>
        <a
          href={proof.value}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate underline"
          style={{ color: 'var(--accent)' }}
          onClick={e => e.stopPropagation()}
        >
          {proof.value.replace(/^https?:\/\//, '').slice(0, 36)}…
        </a>
      </div>
    )
  }

  // For IPFS: link to gateway
  if (proof.type === 'ipfs') {
    const cid = proof.value.replace(/^ipfs:\/\//i, '').replace(/^\/ipfs\//i, '')
    const gatewayUrl = `https://ipfs.io/ipfs/${cid}`
    return (
      <div className="flex items-center gap-1.5">
        <CheckCircle size={11} style={{ color: 'var(--success)', flexShrink: 0 }} />
        <span style={{ color: 'var(--success)', flexShrink: 0 }}>{icon}</span>
        <a
          href={gatewayUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mono truncate underline"
          style={{ color: 'var(--accent)' }}
          onClick={e => e.stopPropagation()}
        >
          {cid.slice(0, 16)}…{cid.slice(-6)}
        </a>
      </div>
    )
  }

  // Tracking + text
  return (
    <div className="flex items-start gap-1.5">
      <CheckCircle size={11} style={{ color: 'var(--success)', flexShrink: 0, marginTop: 1 }} />
      <span className="font-semibold shrink-0" style={{ color: 'var(--success)' }}>{label}:</span>
      <span className="mono truncate" style={{ color: 'var(--ink-2)' }}>
        {proof.value}{proof.carrier && proof.carrier !== 'Other' ? ` (${proof.carrier})` : ''}
      </span>
    </div>
  )
}

interface Props {
  orderKey: `0x${string}`
  order: Order
  connectedAddress?: string
  onClaim?: (key: `0x${string}`) => void
  onSubmitDelivery?: (key: `0x${string}`) => void
  onConfirmDelivery?: (key: `0x${string}`) => void
  onRefund?: (key: `0x${string}`) => void
  onDispute?: (key: `0x${string}`) => void
  isClaiming?: boolean
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function formatDate(ts: bigint) {
  if (ts === 0n) return '—'
  return new Date(Number(ts) * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// Warm status colors matching the amber palette
const STATUS_WARM: Record<number, { bg: string; text: string; label: string }> = {
  0: { bg: 'rgba(232,112,10,0.12)', text: '#a34d00', label: 'Open' },
  1: { bg: 'rgba(26,110,60,0.10)',  text: '#1a6e3c', label: 'Claimed' },
  2: { bg: 'rgba(26,110,60,0.16)',  text: '#1a6e3c', label: 'Delivered' },
  3: { bg: 'rgba(26,110,60,0.22)',  text: '#1a6e3c', label: 'Completed' },
  4: { bg: 'rgba(192,57,43,0.10)',  text: '#c0392b', label: 'Refunded' },
  5: { bg: 'rgba(192,57,43,0.14)',  text: '#c0392b', label: 'Disputed' },
}

export default function OrderCard({
  orderKey, order, connectedAddress,
  onClaim, onSubmitDelivery, onConfirmDelivery, onRefund, onDispute, isClaiming,
}: Props) {
  const isBuyer  = !!connectedAddress && !!order.buyer  && connectedAddress.toLowerCase() === order.buyer.toLowerCase()
  const isWorker = !!connectedAddress && !!order.worker && connectedAddress.toLowerCase() === order.worker.toLowerCase()
  const usdcAmount = order.amount != null ? parseFloat(formatUnits(order.amount, 6)).toFixed(2) : '0.00'
  const mp = (order.sourceMarketplace ?? '').toLowerCase()
  const hasWorker = order.worker && order.worker !== '0x0000000000000000000000000000000000000000'

  const showClaim   = order.status === 0 && !isBuyer && !!onClaim && !!connectedAddress
  const showDeliver = order.status === 1 && isWorker && !!onSubmitDelivery
  const showConfirm = order.status === 2 && isBuyer && !!onConfirmDelivery
  const showRefund  = order.status === 0 && isBuyer && !!onRefund
  const showDispute = (order.status === 1 || order.status === 2) && (isBuyer || isWorker) && !!onDispute
  const hasActions  = showClaim || showDeliver || showConfirm || showRefund || showDispute

  const statusStyle = STATUS_WARM[order.status] ?? STATUS_WARM[0]
  const mpLabel = MARKETPLACE_LABELS[mp] ?? order.sourceMarketplace
  const mpColor = MARKETPLACE_COLORS[mp] ?? 'bg-gray-100 text-gray-600'

  return (
    <div
      className="rounded-3xl overflow-hidden transition-shadow"
      style={{
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(232,112,10,0.10)',
        boxShadow: '0 4px 28px rgba(160,100,30,0.08), inset 0 1px 0 rgba(255,255,255,0.80)',
      }}
    >
      {/* Top accent bar — amber when open, green when done */}
      <div
        style={{
          height: 3,
          background: order.status === 0
            ? 'linear-gradient(90deg, #e8700a, #f5a95c)'
            : order.status >= 3
            ? 'linear-gradient(90deg, #1a6e3c, #52c97b)'
            : 'linear-gradient(90deg, #f5a95c, #e8700a)',
        }}
      />

      {/* Main content */}
      <div className="px-5 pt-4 pb-4">

        {/* Header: title + USDC amount pill */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p
              className="display font-bold text-base leading-snug"
              style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
            >
              {order.title || 'Untitled Order'}
            </p>
            <p className="mono text-xs mt-0.5 truncate" style={{ color: 'var(--subtle)' }}>
              #{order.orderId.slice(0, 20)}
            </p>
          </div>
          {/* Prominent USDC amount — reference-inspired: large pill top-right */}
          <div
            className="flex flex-col items-end shrink-0 px-3.5 py-2 rounded-2xl"
            style={{
              background: 'linear-gradient(145deg, #fff3e0, #ffe0b2)',
              border: '1px solid rgba(232,112,10,0.18)',
              boxShadow: '0 2px 8px rgba(232,112,10,0.10)',
            }}
          >
            <div className="flex items-center gap-1">
              <TokenUSDC variant="branded" size={16} />
              <span
                className="tabular font-bold text-xl display"
                style={{ color: 'var(--accent)', letterSpacing: '-0.03em' }}
              >
                {usdcAmount}
              </span>
            </div>
            <span className="text-xs font-semibold" style={{ color: 'var(--accent-text)', opacity: 0.75 }}>USDC</span>
          </div>
        </div>

        {/* Status + marketplace badges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: statusStyle.bg, color: statusStyle.text }}
          >
            {ORDER_STATUS_LABELS[order.status] ?? statusStyle.label}
          </span>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${mpColor}`}>
            {mpLabel}
          </span>
        </div>

        {/* Description */}
        {order.description && (
          <p
            className="text-sm leading-relaxed mb-3 text-pretty"
            style={{ color: 'var(--ink-2)' }}
          >
            {order.description}
          </p>
        )}

        {/* Meta strip — warm card */}
        <div
          className="rounded-2xl px-3 py-3 flex flex-col gap-1.5 text-xs"
          style={{ background: 'var(--surface-muted)', color: 'var(--muted)' }}
        >
          <div className="flex items-center gap-2">
            <User size={11} style={{ color: 'var(--accent)', opacity: 0.7 }} />
            <span>Buyer <span className="mono">{shortAddr(order.buyer)}</span></span>
            {isBuyer && (
              <span
                className="font-bold px-2 py-0.5 rounded-full text-xs"
                style={{ background: 'rgba(232,112,10,0.14)', color: 'var(--accent)' }}
              >
                you
              </span>
            )}
          </div>
          {hasWorker && (
            <div className="flex items-center gap-2">
              <span style={{ color: 'var(--muted)' }}>Worker</span>
              <WorkerAddress address={order.worker} showYou isYou={isWorker} />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Clock size={11} style={{ color: 'var(--subtle)' }} />
            <span>Posted {formatDate(order.createdAt)}</span>
          </div>
          {order.deliveryProof && (
            <ProofBadge raw={order.deliveryProof} />
          )}
        </div>
      </div>

      {/* Action strip */}
      {hasActions && (
        <div
          className="px-5 py-3.5 flex items-center gap-2"
          style={{
            borderTop: '1px solid rgba(232,112,10,0.08)',
            background: 'rgba(232,112,10,0.03)',
          }}
        >
          {showClaim && (
            <button
              onClick={() => onClaim(orderKey)}
              disabled={isClaiming}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
              style={{
                background: isClaiming
                  ? 'var(--surface-muted)'
                  : 'linear-gradient(145deg, #e8700a, #c75f00)',
                color: isClaiming ? 'var(--muted)' : '#fff',
                boxShadow: isClaiming ? 'none' : '0 4px 16px rgba(232,112,10,0.30)',
              }}
            >
              {isClaiming ? 'Claiming…' : (<>Claim Order <ArrowRight size={14} /></>)}
            </button>
          )}

          {showDeliver && (
            <button
              onClick={() => onSubmitDelivery(orderKey)}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
              style={{
                background: 'linear-gradient(145deg, #1a6e3c, #14532d)',
                color: '#fff',
                boxShadow: '0 4px 16px rgba(26,110,60,0.25)',
              }}
            >
              Submit Delivery <ArrowRight size={14} />
            </button>
          )}

          {showConfirm && (
            <button
              onClick={() => onConfirmDelivery(orderKey)}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
              style={{
                background: 'linear-gradient(145deg, #1a6e3c, #14532d)',
                color: '#fff',
                boxShadow: '0 4px 16px rgba(26,110,60,0.25)',
              }}
            >
              Release Payment <CheckCircle size={14} />
            </button>
          )}

          {showRefund && (
            <button
              onClick={() => onRefund(orderKey)}
              className="flex-1 py-3 px-4 rounded-2xl text-sm font-semibold border transition-all active:scale-[0.98]"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--ink-2)', background: 'transparent' }}
            >
              Refund
            </button>
          )}

          {showDispute && (
            <button
              onClick={() => onDispute(orderKey)}
              className="py-3 px-3 rounded-2xl text-sm font-medium border flex items-center gap-1.5 transition-all active:scale-[0.98] shrink-0"
              style={{ borderColor: 'var(--danger)', color: 'var(--danger)', background: 'transparent' }}
            >
              <AlertCircle size={14} />
              Dispute
            </button>
          )}
        </div>
      )}
    </div>
  )
}
