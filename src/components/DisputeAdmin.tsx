/**
 * DisputeAdmin — owner-only panel that lists all disputed orders and lets
 * the owner resolve each one: pay the worker OR refund the buyer.
 * Shown inside the Agent tab. Only the contract owner (0x362f5b…) can sign.
 */
import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { toast } from 'sonner'
import { AlertCircle, CheckCircle, RotateCcw, Loader2, ExternalLink, User, Package } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import {
  useDisputedOrderKeys,
  useOrder,
  useResolveDispute,
  parseOrderStruct,
} from '../hooks/useEscrow'
import { buildTxExplorerUrl, buildAddressExplorerUrl } from '../onchain-facts'
import { arcTestnet } from 'viem/chains'

const CHAIN_ID = arcTestnet.id
const OWNER_ADDRESS = '0x362f5b4391AC51a56b13F9A63E98bB95731E86a3'

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function DisputedOrderRow({ orderKey, onResolved }: { orderKey: `0x${string}`; onResolved: () => void }) {
  const { data: rawOrder, refetch } = useOrder(orderKey)
  const { resolve, isPending, isConfirming, isSuccess, error, hash } = useResolveDispute()
  const [resolving, setResolving] = useState<'worker' | 'buyer' | null>(null)

  useEffect(() => {
    if (isSuccess) {
      toast.success(
        resolving === 'worker' ? 'Payment sent to worker.' : 'Refund sent to buyer.',
        {
          description: hash ? (
            <a href={buildTxExplorerUrl(CHAIN_ID, hash)} target="_blank" rel="noopener" className="underline">
              View on explorer
            </a>
          ) : undefined,
        }
      )
      setResolving(null)
      void refetch()
      onResolved()
    }
  }, [isSuccess, hash, resolving, refetch, onResolved])

  useEffect(() => {
    if (error) {
      toast.error('Resolve failed', { description: (error as Error).message })
      setResolving(null)
    }
  }, [error])

  if (!rawOrder) return null
  const order = parseOrderStruct(rawOrder)
  if (order.status !== 5) return null   // only show disputed

  const usdcAmount = parseFloat(formatUnits(order.amount, 6)).toFixed(2)
  const busy = isPending || isConfirming

  function handleResolve(payWorker: boolean) {
    setResolving(payWorker ? 'worker' : 'buyer')
    resolve(orderKey, payWorker)
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.90)',
        border: '1px solid rgba(192,57,43,0.16)',
        boxShadow: '0 2px 12px rgba(192,57,43,0.06)',
      }}
    >
      {/* Red accent bar */}
      <div style={{ height: 3, background: 'linear-gradient(90deg, #c0392b, #e74c3c)' }} />

      <div className="px-4 pt-4 pb-3 flex flex-col gap-3">
        {/* Title + amount */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <AlertCircle size={13} style={{ color: '#c0392b' }} className="shrink-0" />
              <p className="font-bold text-sm leading-snug" style={{ color: 'var(--ink)' }}>
                {order.title || 'Untitled Order'}
              </p>
            </div>
            <p className="mono text-xs" style={{ color: 'var(--subtle)' }}>
              #{order.orderId.slice(0, 20)}
            </p>
          </div>
          <div
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl shrink-0"
            style={{ background: '#fff3e0', border: '1px solid rgba(232,112,10,0.18)' }}
          >
            <TokenUSDC variant="branded" size={14} />
            <span className="tabular font-bold text-sm" style={{ color: 'var(--accent)', letterSpacing: '-0.02em' }}>
              {usdcAmount}
            </span>
          </div>
        </div>

        {/* Parties */}
        <div
          className="rounded-xl px-3 py-2.5 flex flex-col gap-1.5 text-xs"
          style={{ background: 'var(--surface-muted)' }}
        >
          <div className="flex items-center gap-2" style={{ color: 'var(--muted)' }}>
            <User size={11} style={{ color: 'var(--accent)', opacity: 0.7 }} />
            <span>Buyer</span>
            <a
              href={buildAddressExplorerUrl(CHAIN_ID, order.buyer)}
              target="_blank" rel="noopener"
              className="mono underline"
              style={{ color: 'var(--accent)' }}
            >
              {shortAddr(order.buyer)}
            </a>
          </div>
          {order.worker && order.worker !== '0x0000000000000000000000000000000000000000' && (
            <div className="flex items-center gap-2" style={{ color: 'var(--muted)' }}>
              <Package size={11} style={{ color: 'var(--success)', opacity: 0.8 }} />
              <span>Worker</span>
              <a
                href={buildAddressExplorerUrl(CHAIN_ID, order.worker)}
                target="_blank" rel="noopener"
                className="mono underline"
                style={{ color: 'var(--success)' }}
              >
                {shortAddr(order.worker)}
              </a>
            </div>
          )}
          {order.deliveryProof && (
            <div className="flex items-start gap-2" style={{ color: 'var(--muted)' }}>
              <ExternalLink size={11} className="shrink-0 mt-0.5" />
              <span className="break-all">Proof: {order.deliveryProof}</span>
            </div>
          )}
        </div>

        {/* Resolution buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleResolve(true)}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98]"
            style={{
              background: busy && resolving === 'worker'
                ? 'var(--surface-muted)'
                : 'linear-gradient(145deg, #1a6e3c, #14532d)',
              color: busy && resolving === 'worker' ? 'var(--muted)' : '#fff',
              boxShadow: busy ? 'none' : '0 3px 10px rgba(26,110,60,0.25)',
              opacity: busy && resolving !== 'worker' ? 0.45 : 1,
            }}
          >
            {busy && resolving === 'worker'
              ? <><Loader2 size={12} className="animate-spin" /> Paying worker…</>
              : <><CheckCircle size={12} /> Pay Worker</>
            }
          </button>
          <button
            onClick={() => handleResolve(false)}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-[0.98]"
            style={{
              borderColor: 'rgba(192,57,43,0.35)',
              color: busy && resolving === 'buyer' ? 'var(--muted)' : '#c0392b',
              background: busy && resolving === 'buyer' ? 'var(--surface-muted)' : 'rgba(192,57,43,0.06)',
              opacity: busy && resolving !== 'buyer' ? 0.45 : 1,
            }}
          >
            {busy && resolving === 'buyer'
              ? <><Loader2 size={12} className="animate-spin" /> Refunding…</>
              : <><RotateCcw size={12} /> Refund Buyer</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DisputeAdmin() {
  const { address, isConnected } = useAccount()
  const { data: disputedKeys, isLoading, refetch } = useDisputedOrderKeys()
  const [resolveCount, setResolveCount] = useState(0)

  const keys = (disputedKeys ?? []) as `0x${string}`[]
  const isOwner = address?.toLowerCase() === OWNER_ADDRESS.toLowerCase()

  if (!isConnected) return null

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{
        background: 'var(--surface-muted)',
        border: '1px solid rgba(192,57,43,0.14)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(192,57,43,0.10)' }}
          >
            <AlertCircle size={14} style={{ color: '#c0392b' }} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--ink)' }}>Dispute Resolution</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Owner-only · {keys.length} disputed</p>
          </div>
        </div>
        <button
          onClick={() => { void refetch() }}
          className="p-1.5 rounded-lg"
          style={{ color: 'var(--muted)' }}
        >
          <RotateCcw size={13} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Not owner warning */}
      {!isOwner && (
        <div
          className="rounded-xl px-3 py-2.5 text-xs"
          style={{ background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e' }}
        >
          Connect as the contract owner{' '}
          <span className="mono font-semibold">{shortAddr(OWNER_ADDRESS)}</span> to resolve disputes.
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2 py-4 justify-center" style={{ color: 'var(--muted)' }}>
          <Loader2 size={14} className="animate-spin" />
          <span className="text-sm">Loading disputed orders…</span>
        </div>
      )}

      {/* Empty */}
      {!isLoading && keys.length === 0 && (
        <div
          className="flex flex-col items-center gap-2 py-6 rounded-xl"
          style={{ background: 'rgba(26,110,60,0.05)', border: '1px dashed rgba(26,110,60,0.18)' }}
        >
          <CheckCircle size={20} style={{ color: 'var(--success)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--success)' }}>No disputed orders</p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>All disputes have been resolved.</p>
        </div>
      )}

      {/* Disputed orders */}
      {!isLoading && keys.length > 0 && (
        <div className="flex flex-col gap-3" key={resolveCount}>
          {keys.map(key => (
            <DisputedOrderRow
              key={key}
              orderKey={key}
              onResolved={() => {
                setResolveCount(n => n + 1)
                void refetch()
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
