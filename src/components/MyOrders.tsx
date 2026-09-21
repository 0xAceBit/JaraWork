import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { toast } from 'sonner'
import { Briefcase } from 'lucide-react'
import {
  useWorkerOrders, useBuyerOrders, useOrder,
  useSubmitDelivery, useConfirmDelivery,
  useRefundOrder, useDisputeOrder, parseOrderStruct,
} from '../hooks/useEscrow'
import OrderCard from './OrderCard'
import DeliveryModal from './DeliveryModal'
import { buildTxExplorerUrl } from '../onchain-facts'
import { arcTestnet } from 'viem/chains'

const CHAIN_ID = arcTestnet.id

function MyOrderItem({
  orderKey, connectedAddress, onAction,
}: {
  orderKey: `0x${string}`
  connectedAddress: `0x${string}`
  onAction: () => void
}) {
  const { data: rawOrder, refetch } = useOrder(orderKey)
  const { submit, isPending: submitting, isConfirming: submitConfirming, isSuccess: submitSuccess, hash: submitHash } = useSubmitDelivery()
  const { confirm, isPending: _confirming, isSuccess: confirmSuccess, hash: confirmHash } = useConfirmDelivery()
  const { refund, isPending: _refunding, isSuccess: refundSuccess, hash: refundHash } = useRefundOrder()
  const { dispute } = useDisputeOrder()
  const [showDeliveryModal, setShowDeliveryModal] = useState(false)

  useEffect(() => {
    if (submitSuccess) {
      toast.success('Delivery submitted!', {
        description: submitHash ? <a href={buildTxExplorerUrl(CHAIN_ID, submitHash)} target="_blank" rel="noopener" className="underline">View on explorer</a> : undefined,
      })
      setShowDeliveryModal(false)
      void refetch()
      onAction()
    }
  }, [submitSuccess, submitHash, refetch, onAction])

  useEffect(() => {
    if (confirmSuccess) {
      toast.success('Payment released!', {
        description: confirmHash ? <a href={buildTxExplorerUrl(CHAIN_ID, confirmHash)} target="_blank" rel="noopener" className="underline">View on explorer</a> : undefined,
      })
      void refetch()
      onAction()
    }
  }, [confirmSuccess, confirmHash, refetch, onAction])

  useEffect(() => {
    if (refundSuccess) {
      toast.success('Refund sent!', {
        description: refundHash ? <a href={buildTxExplorerUrl(CHAIN_ID, refundHash)} target="_blank" rel="noopener" className="underline">View on explorer</a> : undefined,
      })
      void refetch()
      onAction()
    }
  }, [refundSuccess, refundHash, refetch, onAction])

  if (!rawOrder) return null
  const order = parseOrderStruct(rawOrder)

  return (
    <>
      <OrderCard
        orderKey={orderKey}
        order={order}
        connectedAddress={connectedAddress}
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

export default function MyOrders() {
  const { address, isConnected } = useAccount()
  const [tab, setTab] = useState<'worker' | 'buyer'>('worker')
  const [refreshKey, setRefreshKey] = useState(0)

  const { data: workerKeys, isLoading: loadingWorker, refetch: refetchWorker } = useWorkerOrders(address)
  const { data: buyerKeys, isLoading: loadingBuyer, refetch: refetchBuyer } = useBuyerOrders(address)

  const activeKeys = (tab === 'worker' ? workerKeys : buyerKeys) as `0x${string}`[] | undefined
  const isLoading = tab === 'worker' ? loadingWorker : loadingBuyer

  function refresh() {
    void refetchWorker()
    void refetchBuyer()
    setRefreshKey(k => k + 1)
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Connect your wallet to see your orders</p>
        <ConnectKitButton />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface-muted)' }}>
        {(['worker', 'buyer'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors"
            style={{
              background: tab === t ? 'var(--surface-strong)' : 'transparent',
              color: tab === t ? 'var(--ink)' : 'var(--muted)',
              boxShadow: tab === t ? '0 1px 3px rgba(18,45,69,0.08)' : 'none',
            }}
          >
            As {t}
          </button>
        ))}
      </div>

      {/* Count + refresh */}
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          {isLoading ? 'Loading…' : `${(activeKeys ?? []).length} order${(activeKeys ?? []).length !== 1 ? 's' : ''}`}
        </p>
        <button
          onClick={refresh}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
        >
          Refresh
        </button>
      </div>

      {/* Empty */}
      {!isLoading && (!activeKeys || activeKeys.length === 0) && (
        <div
          className="flex flex-col items-center justify-center gap-3 py-16 rounded-2xl"
          style={{ background: 'var(--surface-muted)', border: '1px dashed var(--border)' }}
        >
          <Briefcase size={32} style={{ color: 'var(--subtle)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
            {tab === 'worker' ? 'No orders claimed yet' : 'No orders posted yet'}
          </p>
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>
            {tab === 'worker' ? 'Head to the Order Board to claim your first order' : 'Create an order to get started'}
          </p>
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" key={refreshKey}>
        {(activeKeys ?? []).map((key) => (
          <MyOrderItem
            key={key}
            orderKey={key}
            connectedAddress={address!}
            onAction={refresh}
          />
        ))}
      </div>
    </div>
  )
}
