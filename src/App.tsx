import { useState } from 'react'
import { ConnectKitButton } from 'connectkit'
import { useAccount } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutGrid, Plus, Briefcase, Settings, Bot, ArrowRight, ShieldCheck, Zap, Clock, ShieldAlert } from 'lucide-react'
import { NetworkArc } from '@web3icons/react'
import OrderBoard from './components/OrderBoard'
import CreateOrder from './components/CreateOrder'
import MyOrders from './components/MyOrders'
import MarketplaceSettings from './components/MarketplaceSettings'
import AgentStatus from './components/AgentStatus'
import AdminPanel from './components/AdminPanel'
import { useContractOwner } from './hooks/useEscrow'
import { JARA_WORK_ESCROW } from './contracts/jaraWorkEscrow'

type Tab = 'board' | 'create' | 'my-orders' | 'agent' | 'settings' | 'admin'

const BASE_TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'board',     label: 'Orders',   icon: <LayoutGrid size={18} /> },
  { id: 'create',    label: 'Post',     icon: <Plus size={18} /> },
  { id: 'my-orders', label: 'Mine',     icon: <Briefcase size={18} /> },
  { id: 'agent',     label: 'Agent',    icon: <Bot size={18} /> },
  { id: 'settings',  label: 'Settings', icon: <Settings size={18} /> },
]

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
  transition: { duration: 0.24, ease: [0.25, 0.1, 0.25, 1.0] },
}

const FEATURE_PILLS = [
  { icon: <ShieldCheck size={12} />, label: 'USDC Escrow' },
  { icon: <Zap size={12} />,         label: 'Auto-release' },
  { icon: <Clock size={12} />,       label: 'Sub-second finality' },
]

/* ─── Hero ─────────────────────────────────────────────────────── */
function HeroSection({ onPost, onBrowse }: { onPost: () => void; onBrowse: () => void }) {
  return (
    <motion.div
      className="relative overflow-hidden rounded-3xl mb-5"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Warm amber gradient background */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(145deg, #e8700a 0%, #c75f00 55%, #a34d00 100%)' }}
      />
      {/* Soft light blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div style={{
          position: 'absolute', top: '-30%', right: '-15%',
          width: 340, height: 340, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,200,100,0.45) 0%, transparent 65%)',
          filter: 'blur(55px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-20%', left: '5%',
          width: 260, height: 260, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)',
          filter: 'blur(48px)',
        }} />
        {/* Decorative circle — reminiscent of the reference's profile orb */}
        <div style={{
          position: 'absolute', top: '50%', right: '6%',
          transform: 'translateY(-50%)',
          width: 108, height: 108, borderRadius: '50%',
          background: 'rgba(255,255,255,0.12)',
          border: '1.5px solid rgba(255,255,255,0.28)',
        }} />
        <div style={{
          position: 'absolute', top: '50%', right: '6%',
          transform: 'translateY(-50%)',
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.20)',
          margin: '14px',
        }} />
      </div>

      {/* Content */}
      <div className="relative z-10 px-6 pt-8 pb-8 flex flex-col gap-5">
        {/* Status chips row */}
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
            style={{ background: 'rgba(0,0,0,0.18)', color: 'rgba(255,255,255,0.90)' }}
          >
            <NetworkArc size={13} />
            Arc Testnet
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" />
            Agent Active
          </div>
        </div>

        {/* Headline */}
        <div>
          <p className="text-white/75 text-xs font-semibold uppercase tracking-widest mb-2">
            Order-to-Earner Platform
          </p>
          <h1
            className="display font-bold text-white leading-[1.1] text-balance"
            style={{ fontSize: 'clamp(1.75rem, 6vw, 2.25rem)', letterSpacing: '-0.035em' }}
          >
            Work gets done.<br />
            Payment guaranteed.
          </h1>
          <p className="text-white/65 text-sm mt-3 leading-relaxed max-w-[280px] text-pretty">
            Orders from Jaramarket, Amazon, eBay and Jumia — fulfilled by workers worldwide, paid in USDC.
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-1.5">
          {FEATURE_PILLS.map(p => (
            <div
              key={p.label}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: 'rgba(0,0,0,0.18)', color: 'rgba(255,255,255,0.82)', border: '1px solid rgba(255,255,255,0.16)' }}
            >
              {p.icon}
              {p.label}
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-3 mt-1">
          <button
            onClick={onPost}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.97] shadow-lg"
            style={{ background: '#fff', color: 'var(--accent)', boxShadow: '0 4px 20px rgba(0,0,0,0.20)' }}
          >
            Post an Order
            <ArrowRight size={14} />
          </button>
          <button
            onClick={onBrowse}
            className="px-5 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.97]"
            style={{ background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.30)', color: '#fff' }}
          >
            Browse Orders
          </button>
        </div>
      </div>
    </motion.div>
  )
}

/* ─── Page header ───────────────────────────────────────────────── */
function PageHeader({ label, sub }: { label: string; sub: string }) {
  return (
    <motion.div className="mb-5" {...fadeUp}>
      <h2
        className="display font-bold text-2xl text-balance"
        style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
      >
        {label}
      </h2>
      <p className="text-sm mt-1.5 text-pretty" style={{ color: 'var(--muted)' }}>{sub}</p>
    </motion.div>
  )
}

/* ─── App ───────────────────────────────────────────────────────── */
export default function App() {
  const [tab, setTab] = useState<Tab>('board')
  const [postOrderCreated, setPostOrderCreated] = useState(0)
  const { isConnected, address } = useAccount()
  const { data: ownerRaw } = useContractOwner()
  const owner = (ownerRaw as string | undefined) ?? ''
  const isOwner = !!address && !!owner && address.toLowerCase() === owner.toLowerCase()

  // Build tab list — inject Admin tab between Agent and Settings for owners only
  const TABS = isOwner
    ? [
        ...BASE_TABS.slice(0, 4),
        { id: 'admin' as Tab, label: 'Admin', icon: <ShieldAlert size={18} /> },
        BASE_TABS[4],
      ]
    : BASE_TABS

  return (
    <div className="min-h-dvh relative" style={{ background: 'var(--bg-gradient)' }}>

      {/* Ambient background warm blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div style={{
          position: 'absolute', top: '0%', right: '-8%',
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(232,112,10,0.11) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '15%', left: '-5%',
          width: 320, height: 320, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(245,168,92,0.10) 0%, transparent 70%)',
          filter: 'blur(70px)',
        }} />
      </div>

      {/* Header */}
      <header
        className="sticky top-0 z-40 w-full"
        style={{
          background: 'rgba(253,246,239,0.90)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setTab('board')}
            className="flex items-center gap-2.5 focus:outline-none"
          >
            {/* Logo mark */}
            <img
              src="/logo.svg"
              alt="JaraWork logo"
              className="w-9 h-9 rounded-2xl shrink-0 object-contain"
              style={{ background: '#111', boxShadow: '0 3px 12px rgba(232,112,10,0.38)' }}
            />
            <div className="leading-tight text-left">
              <p className="display font-bold text-sm" style={{ color: 'var(--ink)', letterSpacing: '-0.025em' }}>
                JaraWork
              </p>
              <p className="text-xs" style={{ color: 'var(--subtle)' }}>Order-to-Earner</p>
            </div>
          </button>
          <ConnectKitButton />
        </div>
      </header>

      {/* Body */}
      <main className="relative z-10 max-w-2xl mx-auto px-4 py-6 pb-28">

        {/* Order Board — always mounted, hidden when off-tab so state never resets */}
        <section style={{ display: tab === 'board' ? 'block' : 'none' }}>
          {!isConnected
            ? <HeroSection onPost={() => setTab('create')} onBrowse={() => {}} />
            : <PageHeader
                label="Open Orders"
                sub="Claim an order to earn USDC. Payment releases from escrow once delivery is confirmed."
              />
          }
          <OrderBoard key={postOrderCreated} />
        </section>

        {/* All other tabs — rendered only when active so they don't waste RPC calls */}
        <AnimatePresence mode="popLayout">

          {tab === 'create' && (
            <motion.section key="create" {...fadeUp}>
              <PageHeader
                label="Post an Order"
                sub="Deposit USDC into escrow. A worker claims and fulfils it — payment releases automatically on delivery."
              />
              <div
                className="rounded-3xl p-5"
                style={{
                  background: 'var(--surface-card)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.70)',
                  boxShadow: '0 8px 40px rgba(160,100,30,0.09)',
                }}
              >
                <CreateOrder
                  onCreated={() => {
                    setPostOrderCreated(n => n + 1)
                    setTab('board')
                  }}
                />
              </div>
            </motion.section>
          )}

          {tab === 'my-orders' && (
            <motion.section key="my-orders" {...fadeUp}>
              <PageHeader
                label="My Orders"
                sub="Track orders you claimed as a worker, or orders you posted as a buyer."
              />
              <MyOrders />
            </motion.section>
          )}

          {tab === 'agent' && (
            <motion.section key="agent" {...fadeUp}>
              <PageHeader
                label="Autonomous Agent"
                sub="The platform wallet auto-creates orders, releases payments after delivery, and refunds stale escrows."
              />
              <AgentStatus />
            </motion.section>
          )}

          {tab === 'admin' && (
            <motion.section key="admin" {...fadeUp}>
              <PageHeader
                label="Admin Panel"
                sub="Owner-only: resolve disputes, update fees, and manage the platform agent."
              />
              <AdminPanel />
            </motion.section>
          )}

          {tab === 'settings' && (
            <motion.section key="settings" {...fadeUp}>
              <PageHeader
                label="Marketplace Settings"
                sub="Connect your marketplaces. Orders import automatically and post on-chain."
              />
              <MarketplaceSettings />
              <div
                className="mt-5 rounded-2xl p-4 flex flex-col gap-1.5"
                style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
              >
                <p className="text-xs font-bold uppercase" style={{ color: 'var(--subtle)', letterSpacing: '0.08em' }}>
                  Escrow Contract · Arc Testnet
                </p>
                <a
                  href={`https://explorer.testnet.arc.io/address/${JARA_WORK_ESCROW.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono text-xs underline break-all"
                  style={{ color: 'var(--accent)' }}
                >
                  {JARA_WORK_ESCROW.address}
                </a>
                <p className="text-xs" style={{ color: 'var(--subtle)' }}>
                  USDC held in escrow until delivery is confirmed.
                </p>
              </div>
            </motion.section>
          )}

        </AnimatePresence>
      </main>

      {/* Bottom nav — warm cream */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40"
        style={{
          background: 'rgba(253,246,239,0.96)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--border)',
        }}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-around px-2 py-1.5">
          {TABS.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="relative flex flex-col items-center gap-0.5 min-w-[56px] min-h-[48px] justify-center px-3 py-2 rounded-2xl transition-colors"
                style={{ color: active ? 'var(--accent)' : 'var(--subtle)' }}
              >
                {active && (
                  <motion.div
                    layoutId="tab-bg"
                    className="absolute inset-0 rounded-2xl"
                    style={{ background: 'var(--accent-light)' }}
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  />
                )}
                <span className="relative z-10">{t.icon}</span>
                <span
                  className="relative z-10 text-xs font-semibold"
                  style={{ color: active ? 'var(--accent)' : 'var(--subtle)' }}
                >
                  {t.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
