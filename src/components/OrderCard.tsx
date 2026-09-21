import { formatUnits } from 'viem'
import { Clock, User, Package, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  MARKETPLACE_LABELS,
  MARKETPLACE_COLORS,
  type Order,
} from '../contracts/jaraWorkEscrow'

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

export default function OrderCard({
  orderKey, order, connectedAddress,
  onClaim, onSubmitDelivery, onConfirmDelivery, onRefund, onDispute, isClaiming,
}: Props) {
  const isBuyer  = connectedAddress?.toLowerCase() === order.buyer.toLowerCase()
  const isWorker = connectedAddress?.toLowerCase() === order.worker.toLowerCase()
  const usdcAmount = parseFloat(formatUnits(order.amount, 6)).toFixed(2)
  const mp = order.sourceMarketplace.toLowerCase()
  const hasWorker = order.worker && order.worker !== '0x0000000000000000000000000000000000000000'

  const showClaim   = order.status === 0 && !isBuyer && !!onClaim && !!connectedAddress
  const showDeliver = order.status === 1 && isWorker && !!onSubmitDelivery
  const showConfirm = order.status === 2 && isBuyer && !!onConfirmDelivery
  const showRefund  = order.status === 0 && isBuyer && !!onRefund
  const showDispute = (order.status === 1 || order.status === 2) && (isBuyer || isWorker) && !!onDispute
  const hasActions  = showClaim || showDeliver || showConfirm || showRefund || showDispute

  return (
    <div
      className="rounded-2xl overflow-hidden transition-shadow hover:shadow-lg"
      style={{
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.72)',
        boxShadow: '0 4px 20px rgba(18,45,69,0.07), inset 0 1px 0 rgba(255,255,255,0.6)',
      }}
    >
      {/* Top section */}
      <div className="px-5 pt-5 pb-4">
        {/* Header row: title + USDC amount */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-base leading-snug" style={{ color: 'var(--ink)' }}>
              {order.title || 'Untitled Order'}
            </p>
            <p className="mono text-xs mt-0.5 truncate" style={{ color: 'var(--subtle)' }}>
              #{order.orderId.slice(0, 20)}
            </p>
          </div>
          {/* USDC pill */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl shrink-0"
            style={{
              background: 'rgba(18,45,69,0.06)',
              border: '1px solid rgba(18,45,69,0.10)',
            }}
          >
            <TokenUSDC variant="branded" size={15} />
            <span className="tabular font-bold text-base" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
              {usdcAmount}
            </span>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${ORDER_STATUS_COLORS[order.status]}`}>
            {ORDER_STATUS_LABELS[order.status]}
          </span>
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${MARKETPLACE_COLORS[mp] ?? 'bg-gray-100 text-gray-600'}`}>
            {MARKETPLACE_LABELS[mp] ?? order.sourceMarketplace}
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

        {/* Meta rows */}
        <div
          className="flex flex-col gap-1.5 text-xs rounded-xl px-3 py-2.5"
          style={{ background: 'rgba(18,45,69,0.035)', color: 'var(--subtle)' }}
        >
          <div className="flex items-center gap-2">
            <User size={11} />
            <span>Buyer <span className="mono">{shortAddr(order.buyer)}</span></span>
            {isBuyer && (
              <span className="font-semibold px-1.5 py-0.5 rounded-full text-xs"
                style={{ background: 'rgba(16,97,166,0.10)', color: 'var(--accent-hover)' }}>
                you
              </span>
            )}
          </div>
          {hasWorker && (
            <div className="flex items-center gap-2">
              <Package size={11} />
              <span>Worker <span className="mono">{shortAddr(order.worker)}</span></span>
              {isWorker && (
                <span className="font-semibold px-1.5 py-0.5 rounded-full text-xs"
                  style={{ background: 'rgba(26,128,71,0.10)', color: 'var(--success)' }}>
                  you
                </span>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Clock size={11} />
            <span>Posted {formatDate(order.createdAt)}</span>
          </div>
          {order.deliveryProof && (
            <div className="flex items-center gap-2">
              <CheckCircle size={11} style={{ color: 'var(--success)' }} />
              <span className="truncate">
                Proof: {order.deliveryProof.slice(0, 36)}{order.deliveryProof.length > 36 ? '…' : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action strip — only when there are actions */}
      {hasActions && (
        <div
          className="px-5 py-3 flex items-center gap-2"
          style={{ borderTop: '1px solid rgba(18,45,69,0.07)', background: 'rgba(18,45,69,0.025)' }}
        >
          {/* Claim */}
          {showClaim && (
            <button
              onClick={() => onClaim(orderKey)}
              disabled={isClaiming}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
              style={{
                background: isClaiming ? 'var(--surface-muted)' : 'var(--accent)',
                color: isClaiming ? 'var(--muted)' : '#fff',
                backgroundImage: isClaiming ? 'none' : 'linear-gradient(135deg,#122d45,#1061a6)',
              }}
            >
              {isClaiming ? 'Claiming…' : (
                <>Claim Order <ArrowRight size={14} /></>
              )}
            </button>
          )}

          {/* Submit Delivery */}
          {showDeliver && (
            <button
              onClick={() => onSubmitDelivery(orderKey)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
              style={{ background: 'var(--ink-2)', color: '#fff' }}
            >
              Submit Delivery <ArrowRight size={14} />
            </button>
          )}

          {/* Confirm & Release */}
          {showConfirm && (
            <button
              onClick={() => onConfirmDelivery(orderKey)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
              style={{ background: 'var(--success)', color: '#fff' }}
            >
              Release Payment <CheckCircle size={14} />
            </button>
          )}

          {/* Refund */}
          {showRefund && (
            <button
              onClick={() => onRefund(orderKey)}
              className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold border transition-all active:scale-[0.98]"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--ink-2)', background: 'transparent' }}
            >
              Refund
            </button>
          )}

          {/* Dispute */}
          {showDispute && (
            <button
              onClick={() => onDispute(orderKey)}
              className="py-2.5 px-3 rounded-xl text-sm font-medium border flex items-center gap-1.5 transition-all active:scale-[0.98] shrink-0"
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
