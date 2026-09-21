/**
 * AgentStatus — shows the autonomous agent wallet, USDC balance,
 * auto-release/refund timers, and a live action log.
 */
import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { toast } from 'sonner'
import { Bot, Zap, RefreshCw, Play, CheckCircle, XCircle, RotateCcw, Info, ExternalLink, Loader2, ShieldCheck, AlertTriangle, Webhook, Bell, BellOff, ListRestart } from 'lucide-react'
import DisputeAdmin from './DisputeAdmin'
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
  isLowBalance: boolean
  lowBalanceThreshold: number
  alertWebhookConfigured: boolean
  newOrderWebhookConfigured: boolean
  pushSubscriberCount: number
  vapidEnabled: boolean
  retryQueue: Array<{
    key: string
    orderId: string
    marketplace: string
    amount: string
    attempts: number
    maxRetries: number
    state: 'pending_retry' | 'failed'
    error: string
    lastAttemptAt: number
  }>
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
  const [webhookUrl, setWebhookUrl] = useState('')
  const [savingWebhook, setSavingWebhook] = useState(false)
  const [webhookSaved, setWebhookSaved] = useState(false)

  // New-order webhook
  const [newOrderWebhookUrl, setNewOrderWebhookUrl] = useState('')
  const [savingNewOrderWebhook, setSavingNewOrderWebhook] = useState(false)
  const [newOrderWebhookSaved, setNewOrderWebhookSaved] = useState(false)

  // Browser push notification state
  const [pushSupported] = useState(() => 'serviceWorker' in navigator && 'PushManager' in window)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default')
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [subscribingPush, setSubscribingPush] = useState(false)

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

  // Initialise push state on mount
  useEffect(() => {
    if (!pushSupported) return
    setPushPermission(Notification.permission)
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js')
        const sub = await reg.pushManager.getSubscription()
        setPushSubscribed(!!sub)
      } catch { /* sw not supported in this context */ }
    })()
  }, [pushSupported])

  async function subscribeToPush() {
    if (!pushSupported) return
    setSubscribingPush(true)
    try {
      const permission = await Notification.requestPermission()
      setPushPermission(permission)
      if (permission !== 'granted') {
        toast.error('Notification permission denied. Enable notifications for this site in your browser settings.')
        return
      }
      const vapidRes = await fetch('/api/agent/vapid-public-key')
      const { vapidPublicKey } = await vapidRes.json() as { vapidPublicKey: string | null }
      if (!vapidPublicKey) {
        toast.error('VAPID keys not configured on the server. Add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to .env.')
        return
      }
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey,
      })
      const subJson = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
      const res = await fetch('/api/agent/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subJson),
      })
      if (!res.ok) throw new Error('Server rejected subscription')
      setPushSubscribed(true)
      toast.success('Push notifications enabled! You will be notified when new orders arrive.')
    } catch (e) {
      toast.error('Failed to subscribe', { description: (e as Error).message })
    } finally {
      setSubscribingPush(false)
    }
  }

  async function unsubscribeFromPush() {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/agent/push-unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setPushSubscribed(false)
      toast.success('Push notifications disabled.')
    } catch (e) {
      toast.error('Failed to unsubscribe', { description: (e as Error).message })
    }
  }

  async function saveNewOrderWebhook() {
    if (!newOrderWebhookUrl.trim()) return
    setSavingNewOrderWebhook(true)
    try {
      await fetch('/api/agent/new-order-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newOrderWebhookUrl.trim() }),
      })
      setNewOrderWebhookSaved(true)
      toast.success('New-order webhook saved. Workers will be notified on each new order.')
    } catch (e) {
      toast.error('Failed to save webhook', { description: (e as Error).message })
    } finally {
      setSavingNewOrderWebhook(false)
    }
  }

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

  async function saveWebhook() {
    if (!webhookUrl.trim()) return
    setSavingWebhook(true)
    try {
      await fetch('/api/agent/alert-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl.trim() }),
      })
      setWebhookSaved(true)
      toast.success('Webhook URL saved. You will be alerted when balance drops below the threshold.')
    } catch (e) {
      toast.error('Failed to save webhook', { description: (e as Error).message })
    } finally {
      setSavingWebhook(false)
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

      {/* Low-balance banner */}
      {status && isConfigured && status.isLowBalance && (
        <div
          className="rounded-2xl px-4 py-3 flex items-start gap-3"
          style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}
        >
          <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: '#ea580c' }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: '#9a3412' }}>
              Agent wallet is low on USDC
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#c2410c' }}>
              Balance is <strong>{status.balance} USDC</strong> — below the {status.lowBalanceThreshold} USDC threshold.
              New marketplace orders will be paused until the wallet is topped up.
            </p>
            <p className="text-xs mt-1.5 font-medium" style={{ color: '#9a3412' }}>
              Top up address:{' '}
              <span className="mono">{AGENT_WALLET_ADDRESS || '0xa7d90f5f3654a9d7da551fd24a4fba593a24fde6'}</span>
            </p>
          </div>
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

      {/* Webhook alert config */}
      {status && isConfigured && (
        <div
          className="rounded-2xl p-4 flex flex-col gap-3"
          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <Webhook size={15} style={{ color: 'var(--accent-hover)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Low-Balance Alert</p>
            {status.alertWebhookConfigured && (
              <span
                className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: '#dcfce7', color: '#16a34a' }}
              >
                Webhook active
              </span>
            )}
          </div>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Fire a POST request to a URL of your choice when the agent wallet balance drops below{' '}
            <strong>{status.lowBalanceThreshold} USDC</strong>. Use this to receive a Slack, Discord, or email alert.
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={webhookUrl}
              onChange={e => { setWebhookUrl(e.target.value); setWebhookSaved(false) }}
              placeholder="https://hooks.slack.com/services/…"
              className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', color: 'var(--ink)' }}
            />
            <button
              onClick={() => { void saveWebhook() }}
              disabled={!webhookUrl.trim() || savingWebhook || webhookSaved}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50 shrink-0"
              style={{
                background: webhookSaved ? '#dcfce7' : 'var(--accent)',
                backgroundImage: webhookSaved ? 'none' : 'linear-gradient(135deg,#122d45,#1061a6)',
                color: webhookSaved ? '#16a34a' : '#fff',
              }}
            >
              {savingWebhook && <Loader2 size={13} className="animate-spin" />}
              {webhookSaved ? <><CheckCircle size={13} /> Saved</> : 'Save'}
            </button>
          </div>
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>
            To set a custom threshold, add <code className="mono">LOW_BALANCE_THRESHOLD_USDC=10</code> to your <code className="mono">.env</code> and restart the agent.
          </p>
        </div>
      )}

      {/* Worker Notifications */}
      {status && isConfigured && (
        <div
          className="rounded-2xl p-4 flex flex-col gap-4"
          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <Bell size={15} style={{ color: 'var(--accent-hover)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Worker Notifications</p>
            {status.pushSubscriberCount > 0 && (
              <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>
                {status.pushSubscriberCount} subscriber{status.pushSubscriberCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Notify workers instantly when a new order is posted. Two options: browser push (this device) or a webhook URL (Slack, Discord, Make.com, email relay).
          </p>

          {/* Browser push toggle */}
          {pushSupported ? (
            <div
              className="rounded-xl p-3 flex items-center justify-between gap-3"
              style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {pushSubscribed
                  ? <Bell size={16} style={{ color: '#16a34a' }} />
                  : <BellOff size={16} style={{ color: 'var(--muted)' }} />
                }
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                    {pushSubscribed ? 'Browser push enabled' : 'Enable browser push'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--subtle)' }}>
                    {pushPermission === 'denied'
                      ? 'Blocked by browser — enable in site settings'
                      : pushSubscribed
                        ? 'This browser will receive OS-level notifications'
                        : 'Get an OS notification each time a new order arrives'
                    }
                  </p>
                </div>
              </div>
              {pushPermission !== 'denied' && (
                <button
                  onClick={() => { void (pushSubscribed ? unsubscribeFromPush() : subscribeToPush()) }}
                  disabled={subscribingPush}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                  style={{
                    background: pushSubscribed ? '#fee2e2' : 'var(--accent)',
                    backgroundImage: pushSubscribed ? 'none' : 'linear-gradient(135deg,#e8700a,#a34d00)',
                    color: pushSubscribed ? '#dc2626' : '#fff',
                  }}
                >
                  {subscribingPush && <Loader2 size={12} className="animate-spin" />}
                  {pushSubscribed ? 'Disable' : 'Enable'}
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs rounded-xl px-3 py-2" style={{ background: 'var(--surface-strong)', color: 'var(--subtle)' }}>
              Browser push is not supported in this environment. Use the webhook option below.
            </p>
          )}

          {/* New-order webhook */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <Webhook size={13} style={{ color: 'var(--muted)' }} />
              <p className="text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>New-order webhook</p>
              {status.newOrderWebhookConfigured && (
                <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>Active</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="url"
                value={newOrderWebhookUrl}
                onChange={e => { setNewOrderWebhookUrl(e.target.value); setNewOrderWebhookSaved(false) }}
                placeholder="https://hooks.slack.com/services/…"
                className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', color: 'var(--ink)' }}
              />
              <button
                onClick={() => { void saveNewOrderWebhook() }}
                disabled={!newOrderWebhookUrl.trim() || savingNewOrderWebhook || newOrderWebhookSaved}
                className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50"
                style={{
                  background: newOrderWebhookSaved ? '#dcfce7' : 'var(--accent)',
                  backgroundImage: newOrderWebhookSaved ? 'none' : 'linear-gradient(135deg,#e8700a,#a34d00)',
                  color: newOrderWebhookSaved ? '#16a34a' : '#fff',
                }}
              >
                {savingNewOrderWebhook && <Loader2 size={13} className="animate-spin" />}
                {newOrderWebhookSaved ? <><CheckCircle size={13} /> Saved</> : 'Save'}
              </button>
            </div>
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>
              Payload: <code className="mono">{'{ title, body, orderId, marketplace, amount, url, timestamp }'}</code>
            </p>
          </div>

          {/* VAPID setup note */}
          {!status.vapidEnabled && pushSupported && (
            <div className="rounded-xl px-3 py-2.5 text-xs" style={{ background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e' }}>
              <p className="font-semibold">VAPID keys required for browser push</p>
              <p className="mt-0.5">Run <code className="mono font-semibold">bunx web-push generate-vapid-keys</code> and add <code className="mono">VAPID_PUBLIC_KEY</code>, <code className="mono">VAPID_PRIVATE_KEY</code>, and <code className="mono">VAPID_EMAIL</code> to your <code className="mono">.env</code>, then restart the agent.</p>
            </div>
          )}
        </div>
      )}

      {/* Retry queue */}
      {status && isConfigured && (status.retryQueue?.length ?? 0) > 0 && (
        <div
          className="rounded-2xl p-4 flex flex-col gap-3"
          style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}
        >
          <div className="flex items-center gap-2">
            <ListRestart size={15} style={{ color: '#ea580c' }} />
            <p className="text-sm font-semibold" style={{ color: '#9a3412' }}>
              Retry Queue
            </p>
            <span
              className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: '#ffedd5', color: '#c2410c' }}
            >
              {status.retryQueue.filter(e => e.state === 'pending_retry').length} pending
              {status.retryQueue.filter(e => e.state === 'failed').length > 0 &&
                ` · ${status.retryQueue.filter(e => e.state === 'failed').length} failed`}
            </span>
          </div>
          <p className="text-xs" style={{ color: '#c2410c' }}>
            These orders had USDC approved on-chain but <code className="mono">createOrder</code> failed.
            The agent will retry <code className="mono">createOrder</code> only (no re-approval) up to 3 times.
          </p>
          <div className="flex flex-col gap-2">
            {status.retryQueue.map(entry => (
              <div
                key={entry.key}
                className="rounded-xl px-3 py-2.5 flex flex-col gap-1"
                style={{
                  background: entry.state === 'failed' ? '#fee2e2' : '#ffedd5',
                  border: `1px solid ${entry.state === 'failed' ? '#fca5a5' : '#fdba74'}`,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold truncate" style={{ color: entry.state === 'failed' ? '#991b1b' : '#9a3412' }}>
                    {entry.orderId}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <TokenUSDC variant="branded" size={12} />
                    <span className="text-xs font-semibold tabular" style={{ color: entry.state === 'failed' ? '#991b1b' : '#9a3412' }}>
                      {entry.amount}
                    </span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                      style={{
                        background: entry.state === 'failed' ? '#fecaca' : '#fed7aa',
                        color: entry.state === 'failed' ? '#dc2626' : '#c2410c',
                      }}
                    >
                      {entry.state === 'failed' ? 'Failed' : `Retry ${entry.attempts}/${entry.maxRetries}`}
                    </span>
                  </div>
                </div>
                <p className="text-xs mono truncate" style={{ color: entry.state === 'failed' ? '#b91c1c' : '#c2410c' }}>
                  {entry.error}
                </p>
                <p className="text-xs" style={{ color: entry.state === 'failed' ? '#b91c1c' : '#c2410c' }}>
                  {entry.marketplace} · last attempt {timeAgo(entry.lastAttemptAt)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dispute resolution admin panel */}
      {status && isConfigured && <DisputeAdmin />}

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
