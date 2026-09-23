import { useState, useEffect } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { toast } from 'sonner'
import { Plus, Loader2 } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { parseUnits } from 'viem'
import { useApproveUsdc, useCreateOrder, useUsdcAllowance, useUsdcBalance } from '../hooks/useEscrow'
import { JARA_WORK_ESCROW, MARKETPLACE_LABELS } from '../contracts/jaraWorkEscrow'
import { buildTxExplorerUrl } from '../onchain-facts'
import { arcTestnet } from 'viem/chains'
import type { MarketplaceOrder } from '../lib/marketplaces/types'
import { useMarketplaceOrders } from '../hooks/useMarketplaceOrders'

const MARKETPLACES = ['manual', 'jaramarket', 'amazon', 'ebay', 'jumia'] as const
const CHAIN_ID = arcTestnet.id
const USDC_DECIMALS = 6

function formatUsdc(raw: bigint) {
  return (Number(raw) / 1_000_000).toFixed(2)
}

interface Props {
  prefill?: MarketplaceOrder | null
  onCreated?: () => void
}

export default function CreateOrder({ prefill, onCreated }: Props) {
  const { address, isConnected, chainId: connectedChainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const { orders: mpOrders, loading: mpLoading, refresh: refreshMp } = useMarketplaceOrders()

  const [orderId, setOrderId] = useState(prefill?.externalId ?? '')
  const [title, setTitle] = useState(prefill?.title ?? '')
  const [description, setDescription] = useState(prefill?.description ?? '')
  const [marketplace, setMarketplace] = useState<string>(prefill?.sourceMarketplace ?? 'manual')
  const [amount, setAmount] = useState(prefill?.usdcAmount ?? '')
  const [step, setStep] = useState<'form' | 'approve' | 'create' | 'done'>('form')

  // Apply prefill when a marketplace order is selected
  function applyPrefill(o: MarketplaceOrder) {
    setOrderId(o.externalId)
    setTitle(o.title)
    setDescription(o.description)
    setMarketplace(o.sourceMarketplace)
    setAmount(o.usdcAmount)
  }

  // Hooks
  const { data: balance } = useUsdcBalance(address)
  const { data: allowance, refetch: refetchAllowance } = useUsdcAllowance(address)
  const { approve, isPending: approving, isConfirming: approveConfirming, isSuccess: approveSuccess, error: approveError, hash: approveHash } = useApproveUsdc()
  const { create, isPending: creating, isConfirming: createConfirming, isSuccess: createSuccess, error: createError, hash: createHash } = useCreateOrder()

  const parsedAmount = amount ? (() => { try { return parseUnits(amount, USDC_DECIMALS) } catch { return null } })() : null
  const needsApprove = parsedAmount !== null && (allowance ?? 0n) < parsedAmount

  useEffect(() => {
    if (approveSuccess) {
      toast.success('USDC approved', {
        description: approveHash ? (
          <a href={buildTxExplorerUrl(CHAIN_ID, approveHash)} target="_blank" rel="noopener" className="underline">View on explorer</a>
        ) : undefined,
      })
      void refetchAllowance()
      setStep('create')
    }
  }, [approveSuccess, approveHash, refetchAllowance])

  useEffect(() => {
    if (approveError) toast.error('Approval failed', { description: (approveError as Error).message })
  }, [approveError])

  useEffect(() => {
    if (createSuccess) {
      toast.success('Order created on-chain!', {
        description: createHash ? (
          <a href={buildTxExplorerUrl(CHAIN_ID, createHash)} target="_blank" rel="noopener" className="underline">View on explorer</a>
        ) : undefined,
      })
      setStep('done')
      onCreated?.()
    }
  }, [createSuccess, createHash, onCreated])

  useEffect(() => {
    if (createError) toast.error('Order creation failed', { description: (createError as Error).message })
  }, [createError])

  const isFormValid = orderId.trim() && title.trim() && amount && parsedAmount !== null

  function handleSubmit() {
    if (!isFormValid) return
    if (needsApprove) {
      setStep('approve')
      approve(parsedAmount)
    } else {
      setStep('create')
      create(orderId, title, description, marketplace, amount)
    }
  }

  function reset() {
    setOrderId(''); setTitle(''); setDescription(''); setMarketplace('manual'); setAmount(''); setStep('form')
  }

  const isWrongNetwork = isConnected && connectedChainId !== CHAIN_ID

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Connect your wallet to create an order</p>
        <ConnectKitButton />
      </div>
    )
  }

  if (isWrongNetwork) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <div className="w-full rounded-2xl p-4 flex flex-col gap-3 text-center" style={{ background: '#fef3c7', border: '1px solid #f59e0b' }}>
          <p className="font-semibold text-sm" style={{ color: '#92400e' }}>Wrong network</p>
          <p className="text-xs" style={{ color: '#b45309' }}>
            JaraWork runs on Arc Testnet. Your wallet is on a different network.
          </p>
          <button
            onClick={() => switchChain({ chainId: CHAIN_ID })}
            className="self-center py-2 px-6 rounded-xl text-sm font-semibold"
            style={{ background: '#f59e0b', color: '#fff' }}
          >
            Switch to Arc Testnet
          </button>
        </div>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--success)', color: '#fff' }}>
          <Plus size={24} />
        </div>
        <p className="font-semibold display" style={{ color: 'var(--ink)' }}>Order created!</p>
        <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>
          Workers can now see and claim this order on the Order Board.
        </p>
        <button
          onClick={reset}
          className="py-2.5 px-6 rounded-xl text-sm font-semibold"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          Create Another
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Marketplace order picker */}
      {mpOrders.length > 0 && (
        <div
          className="rounded-2xl p-4 flex flex-col gap-3"
          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              Imported from marketplaces ({mpOrders.length})
            </p>
            <button onClick={refreshMp} className="text-xs" style={{ color: 'var(--accent-hover)' }}>
              {mpLoading ? 'Fetching…' : 'Refresh'}
            </button>
          </div>
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
            {mpOrders.map((o) => (
              <button
                key={`${o.sourceMarketplace}-${o.externalId}`}
                onClick={() => applyPrefill(o)}
                className="text-left rounded-xl p-3 flex items-center justify-between gap-2 border transition-colors hover:border-blue-300"
                style={{ background: 'var(--surface-strong)', borderColor: 'var(--border)' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{o.title}</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>{MARKETPLACE_LABELS[o.sourceMarketplace] ?? o.sourceMarketplace} · #{o.externalId.slice(0, 12)}</p>
                </div>
                <span className="text-sm font-semibold tabular" style={{ color: 'var(--ink)' }}>${o.usdcAmount}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      <div className="flex flex-col gap-4">
        {/* Marketplace + Order ID */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Marketplace</label>
            <select
              value={marketplace}
              onChange={(e) => setMarketplace(e.target.value)}
              className="rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
            >
              {MARKETPLACES.map((m) => (
                <option key={m} value={m}>{MARKETPLACE_LABELS[m] ?? m}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Order ID</label>
            <input
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="e.g. ORD-12345"
              className="rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
            />
          </div>
        </div>

        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Description</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details, delivery instructions, requirements…"
            className="rounded-xl px-3 py-2.5 text-sm resize-none outline-none"
            style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
          />
        </div>

        {/* USDC Amount */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--muted)' }}>USDC Amount</label>
            {balance !== undefined && (
              <span className="text-xs" style={{ color: 'var(--subtle)' }}>
                Balance: {formatUsdc(balance)} USDC
              </span>
            )}
          </div>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <TokenUSDC variant="branded" size={18} />
            </div>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none tabular"
              style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
            />
          </div>
        </div>

        {/* Step explanation */}
        {needsApprove && isFormValid && (
          <p className="text-xs px-3 py-2 rounded-xl" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
            Two steps: (1) approve USDC spend, then (2) create the order. Both require wallet confirmation.
          </p>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!isFormValid || approving || approveConfirming || creating || createConfirming}
          className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          style={{
            background: isFormValid && !approving && !approveConfirming && !creating && !createConfirming
              ? 'var(--accent)' : 'var(--surface-muted)',
            color: isFormValid && !approving && !approveConfirming && !creating && !createConfirming
              ? '#fff' : 'var(--muted)',
          }}
        >
          {(approving || approveConfirming || creating || createConfirming) && <Loader2 size={16} className="animate-spin" />}
          {approving ? 'Approving USDC…' :
            approveConfirming ? 'Confirming approval…' :
            creating ? 'Confirm in wallet…' :
            createConfirming ? 'Creating order…' :
            needsApprove ? 'Approve USDC & Create Order' : 'Create Order'}
        </button>
      </div>

      {/* Contract note */}
      <p className="text-xs text-center" style={{ color: 'var(--subtle)' }}>
        USDC is held in escrow at{' '}
        <a
          href={`https://explorer.testnet.arc.io/address/${JARA_WORK_ESCROW.address}`}
          target="_blank" rel="noopener"
          className="mono underline"
        >
          {JARA_WORK_ESCROW.address.slice(0, 8)}…
        </a>
        {' '}until delivery is confirmed.
      </p>
    </div>
  )
}
