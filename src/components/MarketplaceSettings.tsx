import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { CheckCircle, XCircle, Loader2, Key, Trash2, ExternalLink } from 'lucide-react'
import { loadMarketplaceKeys, saveMarketplaceKeys } from '../lib/marketplaces/storage'
import { getAdapter } from '../lib/marketplaces/registry'
import type { MarketplaceKeys } from '../lib/marketplaces/types'

type TestState = 'idle' | 'testing' | 'ok' | 'fail'

export default function MarketplaceSettings() {
  const [keys, setKeys] = useState<MarketplaceKeys>(loadMarketplaceKeys)
  const [testStates, setTestStates] = useState<Record<string, TestState>>({})
  const [shopInput, setShopInput] = useState(keys.shopify?.shop ?? '')

  // Handle redirect-back query params from all OAuth flows
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    let updated = { ...keys }
    let changed = false

    const connectedShop = params.get('shopify_connected')
    if (connectedShop) {
      updated = { ...updated, shopify: { shop: connectedShop, connected: true } }
      setShopInput(connectedShop)
      toast.success(`Shopify connected: ${connectedShop}`)
      changed = true
    }

    if (params.get('ebay_connected') === 'true') {
      updated = { ...updated, ebay: { connected: true } }
      toast.success('eBay connected successfully')
      changed = true
    }

    if (params.get('amazon_connected') === 'true') {
      updated = { ...updated, amazon: { connected: true } }
      toast.success('Amazon SP-API connected successfully')
      changed = true
    }

    if (changed) {
      setKeys(updated)
      saveMarketplaceKeys(updated)
      window.history.replaceState({}, '', window.location.pathname)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function save(updated: MarketplaceKeys) {
    setKeys(updated)
    saveMarketplaceKeys(updated)
    toast.success('Settings saved')
  }

  async function testOAuthPlatform(platform: string) {
    setTestStates(s => ({ ...s, [platform]: 'testing' }))
    try {
      const res = await fetch(`/api/${platform}/ping`)
      setTestStates(s => ({ ...s, [platform]: res.ok ? 'ok' : 'fail' }))
    } catch {
      setTestStates(s => ({ ...s, [platform]: 'fail' }))
    }
  }

  async function testConnection(platform: string) {
    // OAuth platforms ping the server-side token
    if (['ebay', 'amazon', 'shopify'].includes(platform)) {
      return testOAuthPlatform(platform)
    }
    const adapter = getAdapter(platform)
    if (!adapter) return
    setTestStates(s => ({ ...s, [platform]: 'testing' }))

    let apiKey = ''
    let extra: Record<string, string> = {}
    const k = keys as Record<string, Record<string, string>>

    if (platform === 'jaramarket') {
      apiKey = k.jaramarket?.apiKey ?? ''
      extra = { storeUrl: k.jaramarket?.storeUrl ?? '' }
    } else if (platform === 'jumia') {
      apiKey = k.jumia?.apiKey ?? ''
      extra = { country: k.jumia?.country ?? 'ng' }
    }

    try {
      const ok = await adapter.test(apiKey, extra)
      setTestStates(s => ({ ...s, [platform]: ok ? 'ok' : 'fail' }))
    } catch {
      setTestStates(s => ({ ...s, [platform]: 'fail' }))
    }
  }

  function removeKeys(platform: string) {
    const updated = { ...keys, [platform]: undefined }
    save(updated)
    setTestStates(s => ({ ...s, [platform]: 'idle' }))
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="display font-semibold text-base" style={{ color: 'var(--ink)' }}>Marketplace Connections</h3>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Connect your seller accounts. OAuth platforms (Shopify, eBay, Amazon) redirect you to approve access — no API key needed on your end.
        </p>
      </div>

      {/* Jaramarket */}
      <Section title="Jaramarket.store" platform="jaramarket" testState={testStates.jaramarket ?? 'idle'}
        onTest={() => { void testConnection('jaramarket') }} onRemove={() => removeKeys('jaramarket')}>
        <Field label="API Key" type="password"
          value={keys.jaramarket?.apiKey ?? ''}
          onChange={(v) => save({ ...keys, jaramarket: { apiKey: v, storeUrl: keys.jaramarket?.storeUrl ?? 'https://jaramarket.store' } })}
          placeholder="Bearer token from your Jaramarket admin"
        />
        <Field label="Store URL" type="text"
          value={keys.jaramarket?.storeUrl ?? 'https://jaramarket.store'}
          onChange={(v) => save({ ...keys, jaramarket: { apiKey: keys.jaramarket?.apiKey ?? '', storeUrl: v } })}
          placeholder="https://jaramarket.store"
        />
        <Note>Point to your store&apos;s REST API. The adapter calls <code>/api/orders?status=pending</code>.</Note>
      </Section>

      {/* Amazon — OAuth */}
      <OAuthSection
        title="Amazon"
        platform="amazon"
        connected={!!(keys.amazon as { connected?: boolean } | undefined)?.connected}
        testState={testStates.amazon ?? 'idle'}
        onConnect={() => { window.location.href = '/api/amazon/install' }}
        onTest={() => { void testConnection('amazon') }}
        onDisconnect={() => removeKeys('amazon')}
        connectLabel="Connect Amazon Seller Account"
        connectedNote="The agent is polling your Amazon Seller Central for Unshipped orders every cycle."
        pendingNote={
          <>
            Clicking Connect redirects you to Amazon Seller Central to approve access.
            Your Client ID and Secret are stored server-side — you only need to approve once.{' '}
            <strong>Note:</strong> Amazon SP-API approval may take 1–3 days if you have not applied yet.
          </>
        }
      />

      {/* eBay — OAuth */}
      <OAuthSection
        title="eBay"
        platform="ebay"
        connected={!!(keys.ebay as { connected?: boolean } | undefined)?.connected}
        testState={testStates.ebay ?? 'idle'}
        onConnect={() => { window.location.href = '/api/ebay/install' }}
        onTest={() => { void testConnection('ebay') }}
        onDisconnect={() => removeKeys('ebay')}
        connectLabel="Connect eBay Seller Account"
        connectedNote="The agent is polling your eBay Fulfillment API for orders awaiting shipment."
        pendingNote={
          <>
            Clicking Connect redirects you to eBay to approve access.
            Your credentials are stored server-side.{' '}
            <strong>Note:</strong> eBay developer account approval may take 1 business day.
          </>
        }
      />

      {/* Jumia — key paste (no public OAuth) */}
      <Section title="Jumia" platform="jumia" testState={testStates.jumia ?? 'idle'}
        onTest={() => { void testConnection('jumia') }} onRemove={() => removeKeys('jumia')}>
        <Field label="API Key" type="password"
          value={keys.jumia?.apiKey ?? ''}
          onChange={(v) => save({ ...keys, jumia: { apiKey: v, country: keys.jumia?.country ?? 'ng' } })}
          placeholder="Jumia Seller API Key"
        />
        <Field label="Country Code" type="text"
          value={keys.jumia?.country ?? 'ng'}
          onChange={(v) => save({ ...keys, jumia: { apiKey: keys.jumia?.apiKey ?? '', country: v } })}
          placeholder="ng, ke, gh, eg, ma, cm, ci, tz, ug, za"
        />
        <Note>
          Jumia does not have a public OAuth API. Your API key is issued directly by your Jumia account manager.
          It is stored only in your browser.
        </Note>
      </Section>

      {/* Shopify — OAuth */}
      <ShopifySection
        connected={keys.shopify?.connected ?? false}
        shop={keys.shopify?.shop ?? ''}
        shopInput={shopInput}
        setShopInput={setShopInput}
        testState={testStates.shopify ?? 'idle'}
        onTest={() => { void testConnection('shopify') }}
        onDisconnect={() => {
          removeKeys('shopify')
          setShopInput('')
        }}
      />
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Section({
  title, platform: _platform, testState, onTest, onRemove, children,
}: {
  title: string
  platform: string
  testState: TestState
  onTest: () => void
  onRemove: () => void
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        style={{ background: 'var(--surface-strong)' }}
      >
        <div className="flex items-center gap-2.5">
          <Key size={16} style={{ color: 'var(--muted)' }} />
          <span className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{title}</span>
          {testState === 'ok' && <span className="text-xs px-2 py-0.5 rounded-full text-green-700 bg-green-50">Connected</span>}
          {testState === 'fail' && <span className="text-xs px-2 py-0.5 rounded-full text-red-700 bg-red-50">Failed</span>}
        </div>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-5 py-4 flex flex-col gap-4" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
          {children}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={onTest}
              disabled={testState === 'testing'}
              className="flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs font-semibold border transition-colors"
              style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
            >
              {testState === 'testing' && <Loader2 size={12} className="animate-spin" />}
              Test Connection
            </button>
            {testState !== 'idle' && (
              <div className="flex items-center gap-1">
                <TestIconInline state={testState} />
                <span className="text-xs" style={{ color: testState === 'ok' ? 'var(--success)' : 'var(--danger)' }}>
                  {testState === 'ok' ? 'Connected' : testState === 'fail' ? 'Connection failed' : ''}
                </span>
              </div>
            )}
            <div className="flex-1" />
            <button
              onClick={onRemove}
              className="flex items-center gap-1 py-2 px-3 rounded-xl text-xs text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={12} />
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Generic OAuth section (eBay, Amazon) ──────────────────────────────────────

function OAuthSection({
  title, platform: _platform, connected, testState,
  onConnect, onTest, onDisconnect, connectLabel, connectedNote, pendingNote,
}: {
  title: string
  platform: string
  connected: boolean
  testState: TestState
  onConnect: () => void
  onTest: () => void
  onDisconnect: () => void
  connectLabel: string
  connectedNote: string
  pendingNote: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        style={{ background: 'var(--surface-strong)' }}
      >
        <div className="flex items-center gap-2.5">
          <Key size={16} style={{ color: 'var(--muted)' }} />
          <span className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{title}</span>
          {connected && <span className="text-xs px-2 py-0.5 rounded-full text-green-700 bg-green-50">Connected</span>}
          {testState === 'fail' && <span className="text-xs px-2 py-0.5 rounded-full text-red-700 bg-red-50">Failed</span>}
        </div>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-5 py-4 flex flex-col gap-4" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
          {connected ? (
            <>
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--success)' }}>
                <CheckCircle size={15} />
                <span>{connectedNote}</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={onTest}
                  disabled={testState === 'testing'}
                  className="flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs font-semibold border transition-colors"
                  style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                >
                  {testState === 'testing' ? <Loader2 size={12} className="animate-spin" /> : <TestIconInline state={testState} />}
                  {testState === 'testing' ? 'Checking…' : 'Ping server'}
                </button>
                <div className="flex-1" />
                <button
                  onClick={onDisconnect}
                  className="flex items-center gap-1 py-2 px-3 rounded-xl text-xs text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={12} /> Disconnect
                </button>
              </div>
            </>
          ) : (
            <>
              <Note>{pendingNote}</Note>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={onConnect}
                  className="flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs font-semibold text-white transition-colors"
                  style={{ background: 'var(--accent)' }}
                >
                  <ExternalLink size={12} /> {connectLabel}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function TestIconInline({ state }: { state: TestState }) {
  if (state === 'testing') return <Loader2 size={14} className="animate-spin" style={{ color: 'var(--muted)' }} />
  if (state === 'ok') return <CheckCircle size={14} style={{ color: 'var(--success)' }} />
  if (state === 'fail') return <XCircle size={14} style={{ color: 'var(--danger)' }} />
  return null
}

function Field({ label, type, value, onChange, placeholder }: {
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--muted)' }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-xl px-3 py-2.5 text-sm outline-none"
        style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
      />
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs px-3 py-2 rounded-xl" style={{ background: '#f0f9ff', color: '#0369a1' }}>
      {children}
    </p>
  )
}

// ─── Shopify OAuth section ─────────────────────────────────────────────────────

function ShopifySection({
  connected, shop, shopInput, setShopInput, testState, onTest, onDisconnect,
}: {
  connected: boolean
  shop: string
  shopInput: string
  setShopInput: (v: string) => void
  testState: TestState
  onTest: () => void
  onDisconnect: () => void
}) {
  const [open, setOpen] = useState(false)

  function handleConnect() {
    const raw = shopInput.trim().toLowerCase()
    if (!raw) { toast.error('Enter your Shopify store domain first'); return }
    const domain = raw.endsWith('.myshopify.com') ? raw : `${raw}.myshopify.com`
    window.location.href = `/api/shopify/install?shop=${encodeURIComponent(domain)}`
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        style={{ background: 'var(--surface-strong)' }}
      >
        <div className="flex items-center gap-2.5">
          <Key size={16} style={{ color: 'var(--muted)' }} />
          <span className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>Shopify</span>
          {connected && (
            <span className="text-xs px-2 py-0.5 rounded-full text-green-700 bg-green-50">
              Connected{shop ? `: ${shop}` : ''}
            </span>
          )}
          {testState === 'fail' && <span className="text-xs px-2 py-0.5 rounded-full text-red-700 bg-red-50">Failed</span>}
        </div>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-5 py-4 flex flex-col gap-4" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
          {connected ? (
            <>
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--success)' }}>
                <CheckCircle size={15} />
                <span>Connected to <strong>{shop}</strong>. The agent polls for unfulfilled orders every cycle.</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={onTest}
                  disabled={testState === 'testing'}
                  className="flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs font-semibold border transition-colors"
                  style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                >
                  {testState === 'testing' ? <Loader2 size={12} className="animate-spin" /> : <TestIconInline state={testState} />}
                  {testState === 'testing' ? 'Checking…' : 'Ping server'}
                </button>
                <div className="flex-1" />
                <button
                  onClick={onDisconnect}
                  className="flex items-center gap-1 self-start py-2 px-3 rounded-xl text-xs text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={12} /> Disconnect
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                  Your Shopify Store Domain
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shopInput}
                    onChange={e => setShopInput(e.target.value)}
                    placeholder="mystore.myshopify.com"
                    className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                    onKeyDown={e => { if (e.key === 'Enter') handleConnect() }}
                  />
                </div>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  Enter just the store name (e.g. <code>mystore</code>) or the full domain.
                </p>
              </div>
              <Note>
                Clicking Connect redirects you to Shopify to approve access. No password or API key needed — just log in to your store.
              </Note>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleConnect}
                  className="flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs font-semibold text-white transition-colors"
                  style={{ background: 'var(--accent)' }}
                >
                  <ExternalLink size={12} /> Connect Shopify
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
