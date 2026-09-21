import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle, XCircle, Loader2, Key, Trash2 } from 'lucide-react'
import { loadMarketplaceKeys, saveMarketplaceKeys } from '../lib/marketplaces/storage'
import { getAdapter } from '../lib/marketplaces/registry'
import type { MarketplaceKeys } from '../lib/marketplaces/types'

type TestState = 'idle' | 'testing' | 'ok' | 'fail'

export default function MarketplaceSettings() {
  const [keys, setKeys] = useState<MarketplaceKeys>(loadMarketplaceKeys)
  const [testStates, setTestStates] = useState<Record<string, TestState>>({})

  function save(updated: MarketplaceKeys) {
    setKeys(updated)
    saveMarketplaceKeys(updated)
    toast.success('Settings saved')
  }

  async function testConnection(platform: string) {
    const adapter = getAdapter(platform)
    if (!adapter) return
    setTestStates(s => ({ ...s, [platform]: 'testing' }))

    let apiKey = ''
    let extra: Record<string, string> = {}
    const k = keys as Record<string, Record<string, string>>

    if (platform === 'jaramarket') {
      apiKey = k.jaramarket?.apiKey ?? ''
      extra = { storeUrl: k.jaramarket?.storeUrl ?? '' }
    } else if (platform === 'amazon') {
      apiKey = k.amazon?.accessKey ?? ''
      extra = { sellerId: k.amazon?.sellerId ?? '', marketplaceId: k.amazon?.marketplaceId ?? '' }
    } else if (platform === 'ebay') {
      apiKey = k.ebay?.clientId ?? ''
      extra = { clientSecret: k.ebay?.clientSecret ?? '' }
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
          API keys are stored only in your browser and never shared with any server or put on-chain.
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

      {/* Amazon */}
      <Section title="Amazon" platform="amazon" testState={testStates.amazon ?? 'idle'}
        onTest={() => { void testConnection('amazon') }} onRemove={() => removeKeys('amazon')}>
        <Field label="SP-API Access Key" type="password"
          value={keys.amazon?.accessKey ?? ''}
          onChange={(v) => save({ ...keys, amazon: { ...keys.amazon ?? { secretKey: '', sellerId: '', marketplaceId: '' }, accessKey: v } })}
          placeholder="AKIA…"
        />
        <Field label="SP-API Secret Key" type="password"
          value={keys.amazon?.secretKey ?? ''}
          onChange={(v) => save({ ...keys, amazon: { ...keys.amazon ?? { accessKey: '', sellerId: '', marketplaceId: '' }, secretKey: v } })}
          placeholder="Secret"
        />
        <Field label="Seller ID" type="text"
          value={keys.amazon?.sellerId ?? ''}
          onChange={(v) => save({ ...keys, amazon: { ...keys.amazon ?? { accessKey: '', secretKey: '', marketplaceId: '' }, sellerId: v } })}
          placeholder="A1B2C3D4E5"
        />
        <Field label="Marketplace ID" type="text"
          value={keys.amazon?.marketplaceId ?? 'ATVPDKIKX0DER'}
          onChange={(v) => save({ ...keys, amazon: { ...keys.amazon ?? { accessKey: '', secretKey: '', sellerId: '' }, marketplaceId: v } })}
          placeholder="ATVPDKIKX0DER (US)"
        />
        <Note>Requires a server-side relay at <code>/api/amazon/orders</code> to handle SigV4 signing. See docs.</Note>
      </Section>

      {/* eBay */}
      <Section title="eBay" platform="ebay" testState={testStates.ebay ?? 'idle'}
        onTest={() => { void testConnection('ebay') }} onRemove={() => removeKeys('ebay')}>
        <Field label="Client ID" type="text"
          value={keys.ebay?.clientId ?? ''}
          onChange={(v) => save({ ...keys, ebay: { clientId: v, clientSecret: keys.ebay?.clientSecret ?? '' } })}
          placeholder="eBay Developer App Client ID"
        />
        <Field label="Client Secret" type="password"
          value={keys.ebay?.clientSecret ?? ''}
          onChange={(v) => save({ ...keys, ebay: { clientId: keys.ebay?.clientId ?? '', clientSecret: v } })}
          placeholder="eBay Developer App Secret"
        />
        <Note>Requires a relay at <code>/api/ebay/orders</code> to handle OAuth2. See eBay Developer Program.</Note>
      </Section>

      {/* Jumia */}
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
        <Note>API endpoint: <code>sellercenter-api.{'{country}'}.jumia.com</code>. Falls back to relay if CORS blocks direct access.</Note>
      </Section>
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
      {/* Header */}
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

      {/* Body */}
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
