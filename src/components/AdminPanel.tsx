/**
 * AdminPanel — owner-only contract administration
 * Sections: Contract Info, Fee Settings, Platform Agent, Dispute Resolution, Danger Zone
 */
import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { toast } from 'sonner'
import {
  Shield, Percent, Bot, AlertTriangle, CheckCircle,
  ExternalLink, ChevronDown, ChevronUp, Copy, RefreshCw,
} from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import {
  useContractOwner,
  useContractPlatform,
  useFeeBps,
  useFeeRecipient,
  useSetFeeBps,
  useSetFeeRecipient,
  useSetPlatform,
  useDisputedOrderKeys,
  useResolveDispute,
  useOrder,
} from '../hooks/useEscrow'
import { parseOrderStruct } from '../hooks/useEscrow'
import { JARA_WORK_ESCROW } from '../contracts/jaraWorkEscrow'

const EXPLORER = 'https://explorer.testnet.arc.io'

function shortAddr(a: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—'
}

function TxLink({ hash }: { hash?: string }) {
  if (!hash) return null
  return (
    <a
      href={`${EXPLORER}/tx/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs underline"
      style={{ color: 'var(--accent)' }}
    >
      View tx <ExternalLink size={10} />
    </a>
  )
}

function SectionCard({
  icon, title, children, defaultOpen = true,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'var(--surface-card)',
        border: '1px solid rgba(255,255,255,0.70)',
        boxShadow: '0 4px 20px rgba(160,100,30,0.07)',
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 transition-colors"
        style={{ background: 'transparent' }}
      >
        <div className="flex items-center gap-3">
          <span style={{ color: 'var(--accent)' }}>{icon}</span>
          <span className="font-bold text-sm" style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}>
            {title}
          </span>
        </div>
        {open ? <ChevronUp size={16} style={{ color: 'var(--subtle)' }} /> : <ChevronDown size={16} style={{ color: 'var(--subtle)' }} />}
      </button>
      {open && <div className="px-5 pb-5 flex flex-col gap-4">{children}</div>}
    </div>
  )
}

function InfoRow({ label, value, mono = false, link }: { label: string; value: string; mono?: boolean; link?: string }) {
  const copy = () => { void navigator.clipboard.writeText(value); toast.success('Copied') }
  return (
    <div className="flex items-start justify-between gap-3 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-xs" style={{ color: 'var(--subtle)', minWidth: 100 }}>{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        {link
          ? <a href={link} target="_blank" rel="noopener noreferrer"
              className={`text-xs underline break-all ${mono ? 'mono' : ''}`}
              style={{ color: 'var(--accent)' }}>
              {value}
            </a>
          : <span className={`text-xs break-all ${mono ? 'mono' : ''}`} style={{ color: 'var(--ink)' }}>{value}</span>
        }
        {mono && (
          <button onClick={copy} className="shrink-0 p-0.5 rounded opacity-50 hover:opacity-100 transition-opacity">
            <Copy size={11} style={{ color: 'var(--subtle)' }} />
          </button>
        )}
      </div>
    </div>
  )
}

/* ─── Dispute card ───────────────────────────────────────────────────────── */
function DisputeCard({ orderKey, onResolved }: { orderKey: `0x${string}`; onResolved: () => void }) {
  const { data: raw } = useOrder(orderKey)
  const { resolve, hash, isPending, isConfirming, isSuccess, error } = useResolveDispute()
  const [action, setAction] = useState<'pay' | 'refund' | null>(null)

  const order = raw ? parseOrderStruct(raw) : null

  useEffect(() => {
    if (isSuccess && action) {
      toast.success(action === 'pay' ? 'Payment released to worker' : 'Buyer refunded')
      onResolved()
      setAction(null)
    }
  }, [isSuccess, action, onResolved])

  useEffect(() => {
    if (error) toast.error('Transaction failed', { description: (error as Error).message })
  }, [error])

  if (!order) return (
    <div className="p-3 rounded-xl animate-pulse" style={{ background: 'var(--surface-muted)', height: 80 }} />
  )

  const busy = isPending || isConfirming

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.20)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: 'var(--ink)' }}>{order.title}</p>
          <p className="text-xs mono mt-0.5" style={{ color: 'var(--subtle)' }}>{shortAddr(orderKey)}</p>
        </div>
        <div
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold shrink-0"
          style={{ background: 'rgba(232,112,10,0.12)', color: 'var(--accent)' }}
        >
          <TokenUSDC size={12} />
          {(Number(order.amount) / 1e6).toFixed(2)}
        </div>
      </div>
      <div className="flex gap-1.5 text-xs" style={{ color: 'var(--subtle)' }}>
        <span>Buyer <span className="mono">{shortAddr(order.buyer)}</span></span>
        <span>·</span>
        <span>Worker <span className="mono">{shortAddr(order.worker)}</span></span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => { setAction('pay'); resolve(orderKey, true) }}
          disabled={busy}
          className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.97] disabled:opacity-50"
          style={{ background: 'rgba(26,110,60,0.12)', color: '#1a6e3c', border: '1px solid rgba(26,110,60,0.25)' }}
        >
          {busy && action === 'pay' ? (isPending ? 'Signing…' : 'Confirming…') : '✓ Pay Worker'}
        </button>
        <button
          onClick={() => { setAction('refund'); resolve(orderKey, false) }}
          disabled={busy}
          className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.97] disabled:opacity-50"
          style={{ background: 'rgba(239,68,68,0.10)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          {busy && action === 'refund' ? (isPending ? 'Signing…' : 'Confirming…') : '↩ Refund Buyer'}
        </button>
      </div>
      <TxLink hash={hash} />
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────────────────────── */
export default function AdminPanel() {
  const { address } = useAccount()

  // Contract reads
  const { data: ownerRaw, refetch: refetchOwner }     = useContractOwner()
  const { data: platformRaw, refetch: refetchPlatform } = useContractPlatform()
  const { data: feeBpsRaw, refetch: refetchFee }       = useFeeBps()
  const { data: feeRecipientRaw, refetch: refetchRecipient } = useFeeRecipient()
  const { data: disputedKeys, refetch: refetchDisputes } = useDisputedOrderKeys()

  const owner        = (ownerRaw as string | undefined) ?? ''
  const platform     = (platformRaw as string | undefined) ?? ''
  const feeBps       = feeBpsRaw !== undefined ? Number(feeBpsRaw) : null
  const feeRecipient = (feeRecipientRaw as string | undefined) ?? ''
  const isOwner      = address && owner && address.toLowerCase() === owner.toLowerCase()

  // Fee settings state
  const [feeBpsInput, setFeeBpsInput] = useState('')
  const [feeRecipientInput, setFeeRecipientInput] = useState('')
  const { setFeeBps, hash: feeHash, isPending: feePending, isConfirming: feeConfirming, isSuccess: feeSuccess, error: feeError, reset: feeReset } = useSetFeeBps()
  const { setFeeRecipient, hash: recipHash, isPending: recipPending, isConfirming: recipConfirming, isSuccess: recipSuccess, error: recipError, reset: recipReset } = useSetFeeRecipient()

  // Platform settings state
  const [platformInput, setPlatformInput] = useState('')
  const { setPlatform, hash: platformHash, isPending: platformPending, isConfirming: platformConfirming, isSuccess: platformSuccess, error: platformError, reset: platformReset } = useSetPlatform()

  // Effects
  useEffect(() => {
    if (feeSuccess) { toast.success('Fee updated'); void refetchFee(); feeReset() }
  }, [feeSuccess, refetchFee, feeReset])

  useEffect(() => {
    if (recipSuccess) { toast.success('Fee recipient updated'); void refetchRecipient(); recipReset() }
  }, [recipSuccess, refetchRecipient, recipReset])

  useEffect(() => {
    if (platformSuccess) { toast.success('Platform agent updated'); void refetchPlatform(); platformReset() }
  }, [platformSuccess, refetchPlatform, platformReset])

  useEffect(() => {
    if (feeError) toast.error('Fee update failed', { description: (feeError as Error).message })
  }, [feeError])

  useEffect(() => {
    if (recipError) toast.error('Recipient update failed', { description: (recipError as Error).message })
  }, [recipError])

  useEffect(() => {
    if (platformError) toast.error('Platform update failed', { description: (platformError as Error).message })
  }, [platformError])

  const keys = (disputedKeys as `0x${string}`[] | undefined) ?? []

  // Guard — only owner sees this panel
  if (!address) {
    return (
      <div
        className="rounded-2xl p-6 text-center"
        style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
      >
        <Shield size={28} className="mx-auto mb-3" style={{ color: 'var(--subtle)' }} />
        <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>Connect your wallet</p>
        <p className="text-xs mt-1" style={{ color: 'var(--subtle)' }}>Admin panel requires the owner wallet</p>
      </div>
    )
  }

  if (!isOwner) {
    return (
      <div
        className="rounded-2xl p-6 text-center"
        style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.18)' }}
      >
        <Shield size={28} className="mx-auto mb-3" style={{ color: '#dc2626' }} />
        <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>Access denied</p>
        <p className="text-xs mt-1" style={{ color: 'var(--subtle)' }}>
          Connected as <span className="mono">{shortAddr(address)}</span>
          <br />Owner is <span className="mono">{shortAddr(owner)}</span>
        </p>
      </div>
    )
  }

  const feePercent = feeBps !== null ? (feeBps / 100).toFixed(2) : '—'
  const feeBusy     = feePending || feeConfirming
  const recipBusy   = recipPending || recipConfirming
  const platformBusy = platformPending || platformConfirming

  function refreshAll() {
    void refetchOwner()
    void refetchPlatform()
    void refetchFee()
    void refetchRecipient()
    void refetchDisputes()
    toast('Refreshed')
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Owner badge */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-2xl"
        style={{ background: 'rgba(26,110,60,0.08)', border: '1px solid rgba(26,110,60,0.22)' }}
      >
        <div className="flex items-center gap-2.5">
          <CheckCircle size={16} style={{ color: '#1a6e3c' }} />
          <div>
            <p className="text-xs font-bold" style={{ color: '#1a6e3c' }}>Owner wallet connected</p>
            <p className="text-xs mono mt-0.5" style={{ color: 'var(--subtle)' }}>{shortAddr(address)}</p>
          </div>
        </div>
        <button onClick={refreshAll} className="p-1.5 rounded-xl transition-colors" style={{ background: 'rgba(26,110,60,0.10)' }}>
          <RefreshCw size={13} style={{ color: '#1a6e3c' }} />
        </button>
      </div>

      {/* Contract info */}
      <SectionCard icon={<Shield size={16} />} title="Contract Info">
        <InfoRow label="Address"    value={JARA_WORK_ESCROW.address} mono link={`${EXPLORER}/address/${JARA_WORK_ESCROW.address}`} />
        <InfoRow label="Owner"      value={shortAddr(owner)} mono />
        <InfoRow label="Platform"   value={shortAddr(platform)} mono />
        <InfoRow label="Fee"        value={`${feePercent}% (${feeBps ?? '—'} bps)`} />
        <InfoRow label="Recipient"  value={shortAddr(feeRecipient)} mono />
      </SectionCard>

      {/* Fee settings */}
      <SectionCard icon={<Percent size={16} />} title="Fee Settings">
        {/* Fee BPS */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold" style={{ color: 'var(--subtle)' }}>
            Platform fee (basis points) · current: {feeBps ?? '—'} bps ({feePercent}%)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              max={1000}
              placeholder="e.g. 250 = 2.5%"
              value={feeBpsInput}
              onChange={e => setFeeBpsInput(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-xl text-sm"
              style={{
                background: 'var(--surface-muted)',
                border: '1px solid var(--border)',
                color: 'var(--ink)',
                outline: 'none',
              }}
            />
            <button
              onClick={() => { if (feeBpsInput) setFeeBps(parseInt(feeBpsInput)) }}
              disabled={feeBusy || !feeBpsInput}
              className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.97] disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {feeBusy ? (feePending ? 'Signing…' : 'Confirming…') : 'Update'}
            </button>
          </div>
          <TxLink hash={feeHash} />
        </div>

        {/* Fee recipient */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold" style={{ color: 'var(--subtle)' }}>
            Fee recipient · current: <span className="mono">{shortAddr(feeRecipient)}</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="0x…"
              value={feeRecipientInput}
              onChange={e => setFeeRecipientInput(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-xl text-sm mono"
              style={{
                background: 'var(--surface-muted)',
                border: '1px solid var(--border)',
                color: 'var(--ink)',
                outline: 'none',
              }}
            />
            <button
              onClick={() => { if (feeRecipientInput.startsWith('0x')) setFeeRecipient(feeRecipientInput as `0x${string}`) }}
              disabled={recipBusy || !feeRecipientInput.startsWith('0x')}
              className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.97] disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {recipBusy ? (recipPending ? 'Signing…' : 'Confirming…') : 'Update'}
            </button>
          </div>
          <TxLink hash={recipHash} />
        </div>
      </SectionCard>

      {/* Platform agent */}
      <SectionCard icon={<Bot size={16} />} title="Platform Agent">
        <div
          className="flex items-center justify-between px-3 py-2.5 rounded-xl"
          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
        >
          <div>
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>Current agent</p>
            <p className="text-xs mono mt-0.5 font-semibold" style={{ color: 'var(--ink)' }}>
              {platform ? shortAddr(platform) : '(not set)'}
            </p>
          </div>
          <a
            href={`${EXPLORER}/address/${platform}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg"
            style={{ background: 'var(--accent-light)' }}
          >
            <ExternalLink size={13} style={{ color: 'var(--accent)' }} />
          </a>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold" style={{ color: 'var(--subtle)' }}>
            Set new platform address
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="0x…"
              value={platformInput}
              onChange={e => setPlatformInput(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-xl text-sm mono"
              style={{
                background: 'var(--surface-muted)',
                border: '1px solid var(--border)',
                color: 'var(--ink)',
                outline: 'none',
              }}
            />
            <button
              onClick={() => { if (platformInput.startsWith('0x')) setPlatform(platformInput as `0x${string}`) }}
              disabled={platformBusy || !platformInput.startsWith('0x')}
              className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.97] disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {platformBusy ? (platformPending ? 'Signing…' : 'Confirming…') : 'Update'}
            </button>
          </div>
          <TxLink hash={platformHash} />
        </div>
      </SectionCard>

      {/* Dispute resolution */}
      <SectionCard icon={<AlertTriangle size={16} />} title={`Disputes${keys.length > 0 ? ` (${keys.length})` : ''}`}>
        {keys.length === 0
          ? (
            <div className="py-4 text-center">
              <CheckCircle size={22} className="mx-auto mb-2" style={{ color: '#1a6e3c' }} />
              <p className="text-sm font-semibold" style={{ color: '#1a6e3c' }}>No disputed orders</p>
              <p className="text-xs mt-1" style={{ color: 'var(--subtle)' }}>All clear — nothing needs your review.</p>
            </div>
          )
          : (
            <div className="flex flex-col gap-3">
              {keys.map(k => (
                <DisputeCard
                  key={k}
                  orderKey={k}
                  onResolved={() => void refetchDisputes()}
                />
              ))}
            </div>
          )
        }
      </SectionCard>

      {/* Escrow contract link */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-2xl"
        style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <TokenUSDC size={16} />
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>Escrow Contract · Arc Testnet</p>
            <p className="text-xs mono mt-0.5" style={{ color: 'var(--subtle)' }}>{JARA_WORK_ESCROW.address}</p>
          </div>
        </div>
        <a
          href={`${EXPLORER}/address/${JARA_WORK_ESCROW.address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-lg transition-colors"
          style={{ background: 'var(--accent-light)' }}
        >
          <ExternalLink size={13} style={{ color: 'var(--accent)' }} />
        </a>
      </div>

    </div>
  )
}
