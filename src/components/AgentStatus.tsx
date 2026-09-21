/**
 * AgentStatus — shows the autonomous agent wallet, USDC balance,
 * auto-release/refund timers, and a live action log.
 */
import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { toast } from 'sonner'
import { Bot, Zap, RefreshCw, Play, CheckCircle, XCircle, RotateCcw, Info, ExternalLink, Loader2, ShieldCheck } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { buildTxExplorerUrl, buildAddressExplorerUrl } from '../onchain-facts'
import { arcTestnet } from 'viem/chains'
import { useSetPlatform } from '../hooks/useEscrow'

const CHAIN_ID = arcTestnet.id

interface AgentAction {
  timestamp: number
  type: 'create_order' | 'confirm_delivery' | 'refund_order' | 'error' | 'info'
  orderId?: string
  marketplace?: string
  amount?: string
  txHash?: string
  message: string
}

interface AgentStatusData {
  agentWalletId: string | null
  contractAddress: string | null
  balance: string
  pollIntervalMs: number
  autoReleaseDelayHours: number
  autoRefundDelayDays: number
  actions: AgentAction[]
}

const ACTION_ICONS: Record<AgentAction['type'], React.ReactNode> = {
  create_order:     <Zap size={14} style={{ color: '#2563eb' }} />,
  confirm_delivery: <CheckCircle size={14} style={{ color: '#16a34a' }} />,
  refund_order:     <RotateCcw size={14} style={{ color: '#7c3aed' }} />,
  error:            <XCircle size={14} style={{ color: '#dc2626' }} />,
  info:             <Info size={14} style={{ color: 'var(--muted)' }} />,
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// Agent wallet address (set after setup)
const AGENT_WALLET_ADDRESS = (import.meta.env.VITE_AGENT_WALLET_ADDRESS ?? '') as `0x${string}`

export default function AgentStatus() {
  const [status, setStatus] = useState<AgentStatusData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [triggering, setTriggering] = useState(false)
  const [settingUp, setSettingUp] = useState(false)
  const [setupResult, setSetupResult] = useState<{ walletId: string; address: string; instructions: string[] } | null>(null)

  const { isConnected } = useAccount()
  const { setPlatform, isPending: setPlatformPending, isConfirming: setPlatformConfirming, isSuccess: setPlatformSuccess, error: setPlatformError } = useSetPlatform()

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/agent/status')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as AgentStatusData
      setStatus(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchStatus()
    const id = setInterval(() => { void fetchStatus() }, 15_000)
    return () => clearInterval(id)
  }, [fetchStatus])

  useEffect(() => {
    if (setPlatformSuccess) toast.success('Platform agent set! Autonomous mode is now active.')
  }, [setPlatformSuccess])

  useEffect(() => {
    if (setPlatformError) toast.error('setPlatform failed', { description: (setPlatformError as Error).message })
  }, [setPlatformError])

  async function triggerCycle() {
    setTriggering(true)
    try {
      await fetch('/api/agent/run', { method: 'POST' })
      await new Promise(r => setTimeout(r, 3000))
      await fetchStatus()
    } finally {
      setTriggering(false)
    }
  }

  async function setupWallet() {
    setSettingUp(true)
    try {
      const res = await fetch('/api/agent/setup', { method: 'POST' })
      const data = await res.json() as { walletId?: string; address?: string; instructions?: string[]; error?: string }
      if (data.error) throw new Error(data.error)
      setSetupResult({ walletId: data.walletId ?? '', address: data.address ?? '', instructions: data.instructions ?? [] })
      await fetchStatus()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSettingUp(false)
    }
  }

  const isConfigured = status?.agentWalletId && status?.contractAddress
  const backendDown = error !== null && !status

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: isConfigured ? '#dcfce7' : 'var(--surface-muted)' }}
          >
            <Bot size={18} style={{ color: isConfigured ? '#16a34a' : 'var(--muted)' }} />
          </div>
          <div>
            <p className="display font-semibold text-sm" style={{ color: 'var(--ink)' }}>Autonomous Agent</p>
            <p className="text-xs" style={{ color: isConfigured ? '#16a34a' : 'var(--muted)' }}>
              {backendDown ? 'Backend offline' : isConfigured ? 'Active' : 'Needs setup'}
            </p>
          </div>
        </div>
        <button
          onClick={() => { void fetchStatus() }}
          disabled={loading}
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'var(--muted)' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Backend offline warning */}
      {backendDown && (
        <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e' }}>
          <p className="font-semibold">Agent backend not running</p>
          <p className="text-xs mt-1">Start it with: <code className="mono font-semibold">bun run agent</code> in a terminal, then refresh.</p>
        </div>
      )}

      {/* Setup prompt */}
      {!backendDown && status && !isConfigured && !setupResult && (
        <div
          className="rounded-2xl p-4 flex flex-col gap-3"
          style={{ background: 'var(--surface-muted)', border: '1px dashed var(--border)' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Create the platform agent wallet</p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            A Circle developer-controlled wallet will be created. The platform uses it to auto-create orders, release payments, and refund stale escrows — no human clicks needed.
          </p>
          <button
            onClick={() => { void setupWallet() }}
            disabled={settingUp}
            className="self-start flex items-center gap-2 py-2 px-4 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {settingUp && <Loader2 size={14} className="animate-spin" />}
            {settingUp ? 'Creating wallet…' : 'Create Agent Wallet'}
          </button>
        </div>
      )}

      {/* Setup result */}
      {setupResult && (
        <div className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
          <p className="text-sm font-semibold text-green-800">Wallet created!</p>
          <p className="text-xs text-green-700">Address: <span className="mono">{setupResult.address}</span></p>
          <p className="text-xs font-semibold text-green-800 mt-1">Add to .env and fund this wallet with USDC:</p>
          {setupResult.instructions.map((line, i) => (
            <p key={i} className="mono text-xs text-green-900 bg-green-100 rounded px-2 py-1">{line}</p>
          ))}
          <p className="text-xs text-green-700 mt-1">Then redeploy the escrow contract with <code className="mono">platform={setupResult.address}</code></p>
        </div>
      )}

      {/* Set Platform card — shown when wallet is configured */}
      {status && isConfigured && (
        <div
          className="rounded-2xl p-4 flex flex-col gap-3"
          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} style={{ color: 'var(--accent-hover)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Activate Platform Role</p>
          </div>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Call <code className="mono">setPlatform</code> on the escrow contract so the agent wallet can create orders, release payments, and issue refunds autonomously. Connect as the contract owner to sign.
          </p>
          <div
            className="mono text-xs px-3 py-2 rounded-xl break-all"
            style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', color: 'var(--ink-2)' }}
          >
            {AGENT_WALLET_ADDRESS || '0xa7d90f5f3654a9d7da551fd24a4fba593a24fde6'}
          </div>
          {setPlatformSuccess ? (
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--success)' }}>
              <CheckCircle size={15} />
              Platform role active — agent can now move money autonomously.
            </div>
          ) : (
            <button
              onClick={() => setPlatform((AGENT_WALLET_ADDRESS || '0xa7d90f5f3654a9d7da551fd24a4fba593a24fde6'))}
              disabled={!isConnected || setPlatformPending || setPlatformConfirming}
              className="self-start flex items-center gap-2 min-h-[44px] px-5 py-2 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50"
              style={{ background: 'var(--accent)', backgroundImage: 'linear-gradient(135deg,#122d45,#1061a6)', color: '#fff' }}
            >
              {(setPlatformPending || setPlatformConfirming) && <Loader2 size={14} className="animate-spin" />}
              {setPlatformPending ? 'Waiting for wallet…' : setPlatformConfirming ? 'Confirming…' : 'Set Platform Agent'}
            </button>
          )}
          {!isConnected && (
            <p className="text-xs" style={{ color: 'var(--danger)' }}>Connect your owner wallet to sign this transaction.</p>
          )}
        </div>
      )}

      {/* Wallet + balance row */}
      {status && isConfigured && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-4 flex flex-col gap-1" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
            <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--muted)' }}>Agent Wallet</p>
            <a
              href={buildAddressExplorerUrl(CHAIN_ID, status.agentWalletId!)}
              target="_blank" rel="noopener"
              className="mono text-xs underline truncate"
              style={{ color: 'var(--accent-hover)' }}
            >
              {status.agentWalletId!.slice(0, 12)}…
            </a>
          </div>
          <div className="rounded-2xl p-4 flex flex-col gap-1" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
            <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--muted)' }}>USDC Balance</p>
            <div className="flex items-center gap-1.5">
              <TokenUSDC variant="branded" size={16} />
              <span className="tabular font-semibold text-sm" style={{ color: 'var(--ink)' }}>{status.balance}</span>
            </div>
          </div>
        </div>
      )}

      {/* Timers */}
      {status && isConfigured && (
        <div className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
          <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--muted)' }}>Automation Rules</p>
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--ink-2)' }}>Auto-release payment</span>
              <span className="tabular text-xs font-semibold" style={{ color: 'var(--ink)' }}>{status.autoReleaseDelayHours}h after delivery</span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--ink-2)' }}>Auto-refund unclaimed</span>
              <span className="tabular text-xs font-semibold" style={{ color: 'var(--ink)' }}>{status.autoRefundDelayDays}d without a claim</span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--ink-2)' }}>Poll interval</span>
              <span className="tabular text-xs font-semibold" style={{ color: 'var(--ink)' }}>{status.pollIntervalMs / 1000}s</span>
            </div>
          </div>
        </div>
      )}

      {/* Manual trigger */}
      {status && isConfigured && (
        <button
          onClick={() => { void triggerCycle() }}
          disabled={triggering}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-colors"
          style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
        >
          {triggering ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {triggering ? 'Running cycle…' : 'Run Agent Cycle Now'}
        </button>
      )}

      {/* Action log */}
      {status && (status.actions?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--muted)' }}>Recent Actions</p>
          <div className="flex flex-col gap-1.5">
            {(status.actions ?? []).map((a, i) => (
              <div
                key={i}
                className="rounded-xl px-3 py-2.5 flex items-start gap-2.5"
                style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
              >
                <div className="shrink-0 mt-0.5">{ACTION_ICONS[a.type]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--ink)' }}>{a.message}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs" style={{ color: 'var(--subtle)' }}>{timeAgo(a.timestamp)}</span>
                    {a.txHash && (
                      <a
                        href={buildTxExplorerUrl(CHAIN_ID, a.txHash)}
                        target="_blank" rel="noopener"
                        className="flex items-center gap-0.5 text-xs underline"
                        style={{ color: 'var(--accent-hover)' }}
                      >
                        <ExternalLink size={10} />
                        tx
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty log */}
      {status && (status.actions?.length ?? 0) === 0 && !backendDown && (
        <div
          className="flex flex-col items-center gap-2 py-10 rounded-2xl"
          style={{ background: 'var(--surface-muted)', border: '1px dashed var(--border)' }}
        >
          <Bot size={28} style={{ color: 'var(--subtle)' }} />
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No actions yet</p>
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>The agent will log every order it creates, payment it releases, and refund it issues.</p>
        </div>
      )}
    </div>
  )
}
