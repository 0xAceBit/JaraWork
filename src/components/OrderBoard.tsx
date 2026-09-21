import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { RefreshCw, ShoppingBag, Loader2 } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import {
  useOpenOrderKeys, useOrder, useClaimOrder,
  useSubmitDelivery, useConfirmDelivery,
  useRefundOrder, useDisputeOrder, parseOrderStruct,
} from '../hooks/useEscrow'
import OrderCard from './OrderCard'
import DeliveryModal from './DeliveryModal'
import { buildTxExplorerUrl } from '../onchain-facts'
import { arcTestnet } from 'viem/chains'


function SingleOrder({
  orderKey, connectedAddress,
  onClaimSuccess, onDeliverySuccess, onConfirmSuccess, onRefundSuccess,
}: {
  orderKey: `0x${string}`
  connectedAddress?: string
  onClaimSuccess: () => void
  onDeliverySuccess: () => void
  onConfirmSuccess: () => void
  onRefundSuccess: () => void
}) {
  const { data: rawOrder, refetch } = useOrder(orderKey)
  const { claim, isPending: claiming, isConfirming: claimConfirming, isSuccess: claimSuccess, error: claimError, hash: claimHash } = useClaimOrder()
  const { submit, isPending: submitting, isConfirming: submitConfirming, isSuccess: submitSuccess, hash: submitHash } = useSubmitDelivery()
  const { confirm, isPending: _confirming, isConfirming: _confirmConfirming, isSuccess: confirmSuccess, hash: confirmHash } = useConfirmDelivery()
  const { refund, isPending: _refunding, isConfirming: _refundConfirming, isSuccess: refundSuccess, hash: refundHash } = useRefundOrder()
  const { dispute } = useDisputeOrder()

  const [showDeliveryModal, setShowDeliveryModal] = useState(false)

  // Toast on success/error
  useEffect(() => {
    if (claimSuccess) {
      toast.success('Order claimed!', {
        description: claimHash ? (
          <a href={buildTxExplorerUrl(arcTestnet.id, claimHash)} target="_blank" rel="noopener" className="underline">View on explorer</a>
        ) : undefined,
      })
      void refetch()
      onClaimSuccess()
    }
  }, [claimSuccess, claimHash, refetch, onClaimSuccess])

  useEffect(() => {
    if (claimError) toast.error('Claim failed', { description: (claimError as Error).message })
  }, [claimError])

  useEffect(() => {
    if (submitSuccess) {
      toast.success('Delivery submitted!', {
        description: submitHash ? (
          <a href={buildTxExplorerUrl(arcTestnet.id, submitHash)} target="_blank" rel="noopener" className="underline">View on explorer</a>
        ) : undefined,
      })
      void refetch()
      setShowDeliveryModal(false)
      onDeliverySuccess()
    }
  }, [submitSuccess, submitHash, refetch, onDeliverySuccess])

  useEffect(() => {
    if (confirmSuccess) {
      toast.success('Payment released to worker!', {
        description: confirmHash ? (
          <a href={buildTxExplorerUrl(arcTestnet.id, confirmHash)} target="_blank" rel="noopener" className="underline">View on explorer</a>
        ) : undefined,
      })
      void refetch()
      onConfirmSuccess()
    }
  }, [confirmSuccess, confirmHash, refetch, onConfirmSuccess])

  useEffect(() => {
    if (refundSuccess) {
      toast.success('Refund sent!', {
        description: refundHash ? (
          <a href={buildTxExplorerUrl(arcTestnet.id, refundHash)} target="_blank" rel="noopener" className="underline">View on explorer</a>
        ) : undefined,
      })
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

interface Props {
  statusFilter?: number | null
  buyerFilter?: `0x${string}`
  workerFilter?: `0x${string}`
}

// Tiny hook to sum USDC across visible orders for the stats bar
function useOrdersTotal(keys: `0x${string}`[]) {
  // We just show count; total USDC would need per-order reads — keep it fast
  return keys.length
}

export default function OrderBoard({ statusFilter = null, buyerFilter: _buyerFilter, workerFilter: _workerFilter }: Props) {
  const { address } = useAccount()
  const { data: openKeys, isLoading, refetch } = useOpenOrderKeys()
  const [refreshKey, setRefreshKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const keys = (openKeys ?? []) as `0x${string}`[]
  const filtered = statusFilter !== null ? keys : keys
  useOrdersTotal(filtered) // keep hook call; value unused beyond count

  async function handleRefresh() {
    setRefreshing(true)
    await refetch()
    setRefreshKey(k => k + 1)
    setRefreshing(false)
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Stats bar */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-center justify-between rounded-2xl px-4 py-3"
        style={{
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.68)',
          boxShadow: '0 4px 16px rgba(18,45,69,0.05)',
        }}
      >
        <div className="flex items-center gap-3">
          {isLoading
            ? <Loader2 size={14} className="animate-spin" style={{ color: 'var(--muted)' }} />
            : (
              <div className="flex items-center gap-1.5">
                <TokenUSDC variant="branded" size={18} />
                <span className="display font-bold text-lg tabular" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
                  {filtered.length}
                </span>
                <span className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
                  open order{filtered.length !== 1 ? 's' : ''}
                </span>
              </div>
            )
          }
        </div>
        <button
          onClick={() => { void handleRefresh() }}
          disabled={refreshing || isLoading}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all active:scale-95"
          style={{
            background: 'var(--surface-muted)',
            border: '1px solid var(--border)',
            color: 'var(--muted)',
          }}
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </motion.div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {[0, 1].map(i => (
            <div
              key={i}
              className="rounded-2xl h-36 animate-pulse"
              style={{ background: 'var(--surface-muted)' }}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col items-center justify-center gap-3 py-16 rounded-2xl"
          style={{ background: 'var(--surface-muted)', border: '1px dashed var(--border)' }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
          >
            <ShoppingBag size={22} style={{ color: 'var(--subtle)' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>No open orders right now</p>
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>The agent will post orders here automatically.</p>
        </motion.div>
      )}

      {/* Order cards — staggered entrance */}
      <div className="flex flex-col gap-3" key={refreshKey}>
        {filtered.map((key, i) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: i * 0.04, ease: [0.25, 0.1, 0.25, 1.0] }}
          >
            <SingleOrder
              orderKey={key}
              connectedAddress={address}
              onClaimSuccess={() => setRefreshKey(k => k + 1)}
              onDeliverySuccess={() => setRefreshKey(k => k + 1)}
              onConfirmSuccess={() => setRefreshKey(k => k + 1)}
              onRefundSuccess={() => setRefreshKey(k => k + 1)}
            />
          </motion.div>
        ))}
      </div>
    </div>
  )
}
