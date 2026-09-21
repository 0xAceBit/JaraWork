import { useState } from 'react'
import { ConnectKitButton } from 'connectkit'
import { useAccount } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutGrid, Plus, Briefcase, Settings, Bot, ArrowRight, ShieldCheck, Zap, Clock } from 'lucide-react'
import { NetworkArc } from '@web3icons/react'
import OrderBoard from './components/OrderBoard'
import CreateOrder from './components/CreateOrder'
import MyOrders from './components/MyOrders'
import MarketplaceSettings from './components/MarketplaceSettings'
import AgentStatus from './components/AgentStatus'
import { JARA_WORK_ESCROW } from './contracts/jaraWorkEscrow'

type Tab = 'board' | 'create' | 'my-orders' | 'agent' | 'settings'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'board',     label: 'Orders',   icon: <LayoutGrid size={18} /> },
  { id: 'create',    label: 'Post',     icon: <Plus size={18} /> },
  { id: 'my-orders', label: 'Mine',     icon: <Briefcase size={18} /> },
  { id: 'agent',     label: 'Agent',    icon: <Bot size={18} /> },
  { id: 'settings',  label: 'Settings', icon: <Settings size={18} /> },
]

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
  transition: { duration: 0.22, ease: [0.25, 0.1, 0.25, 1.0] },
}

const FEATURE_PILLS = [
  { icon: <ShieldCheck size={13} />, label: 'USDC Escrow' },
  { icon: <Zap size={13} />,         label: 'Auto-release' },
  { icon: <Clock size={13} />,       label: 'Sub-second finality' },
]

function HeroSection({ onPost, onBrowse }: { onPost: () => void; onBrowse: () => void }) {
  return (
    <motion.div
      className="relative overflow-hidden rounded-3xl mb-6"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.25, 0.1, 0.25, 1.0] }}
    >
      {/* Background */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(145deg, #0d1f35 0%, #122d45 45%, #0e3460 100%)' }}
      />
      {/* Ambient blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div style={{
          position: 'absolute', top: '-20%', right: '-10%',
          width: 320, height: 320, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,97,166,0.55) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-15%', left: '10%',
          width: 240, height: 240, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(95,190,255,0.18) 0%, transparent 70%)',
          filter: 'blur(45px)',
        }} />
      </div>

      {/* Spectral top strip */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: 'linear-gradient(90deg, #5fbeff, #af8ff4, #f05c6b, #ffcd83, #7ef1b3)',
      }} />

      {/* Content */}
      <div className="relative z-10 px-6 pt-8 pb-7 flex flex-col gap-5">
        {/* Badge row */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{
            background: 'rgba(255,255,255,0.10)',
            border: '1px solid rgba(255,255,255,0.18)',
          }}>
            <NetworkArc size={14} />
            <span className="text-white/80 text-xs font-medium">Arc Testnet</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{
            background: 'rgba(126,241,179,0.15)',
            border: '1px solid rgba(126,241,179,0.30)',
          }}>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-300 text-xs font-medium">Agent Active</span>
          </div>
        </div>

        {/* Headline */}
        <div>
          <h1
            className="display font-bold text-white leading-[1.12]"
            style={{ fontSize: 'clamp(1.6rem, 5vw, 2.1rem)', letterSpacing: '-0.04em' }}
          >
            Work gets done.<br />
            <span style={{ color: '#7ef1b3' }}>Payment guaranteed.</span>
          </h1>
          <p className="text-white/60 text-sm mt-3 leading-relaxed max-w-xs text-pretty">
            Orders from Jaramarket, Amazon, eBay, and Jumia — fulfilled by workers worldwide, paid automatically in USDC.
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2">
          {FEATURE_PILLS.map(p => (
            <div
              key={p.label}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.14)',
                color: 'rgba(255,255,255,0.75)',
              }}
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
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{ background: '#fff', color: '#122d45' }}
          >
            Post an Order
            <ArrowRight size={14} />
          </button>
          <button
            onClick={onBrowse}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{
              background: 'rgba(255,255,255,0.10)',
              border: '1px solid rgba(255,255,255,0.22)',
              color: 'rgba(255,255,255,0.88)',
            }}
          >
            Browse Orders
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function PageHeader({ label, sub }: { label: string; sub: string }) {
  return (
    <motion.div className="mb-5" {...fadeUp}>
      <h2
        className="display font-semibold text-xl"
        style={{ color: 'var(--ink)', letterSpacing: '-0.025em' }}
      >
        {label}
      </h2>
      <p className="text-sm mt-1 text-pretty" style={{ color: 'var(--muted)' }}>{sub}</p>
    </motion.div>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>('board')
  const [postOrderCreated, setPostOrderCreated] = useState(0)
  const { isConnected } = useAccount()

  return (
    <div className="min-h-dvh relative overflow-hidden" style={{ background: 'var(--bg-gradient)' }}>
      {/* Ambient background blobs (subtle, warm) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div style={{
          position: 'absolute', top: '5%', left: '-5%',
          width: 350, height: 350, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(133,177,237,0.13) 0%, transparent 70%)',
          filter: 'blur(70px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '10%', right: '-5%',
          width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,205,131,0.12) 0%, transparent 70%)',
          filter: 'blur(65px)',
        }} />
      </div>

      {/* Header */}
      <header
        className="sticky top-0 z-40 w-full"
        style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setTab('board')}
            className="flex items-center gap-2.5 focus:outline-none"
          >
            {/* Logo mark */}
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm display shrink-0 shadow-sm"
              style={{
                background: 'linear-gradient(135deg, #122d45 0%, #1061a6 100%)',
                boxShadow: '0 2px 8px rgba(18,45,69,0.28)',
              }}
            >
              J
            </div>
            <div className="leading-tight text-left">
              <p className="display font-bold text-sm" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                JaraWork
              </p>
              <p className="text-xs font-medium" style={{ color: 'var(--subtle)' }}>Order-to-Earner</p>
            </div>
          </button>
          <ConnectKitButton />
        </div>
      </header>

      {/* Body */}
      <main className="relative z-10 max-w-2xl mx-auto px-4 py-6 pb-28">
        <AnimatePresence mode="wait">

          {/* Order Board */}
          {tab === 'board' && (
            <motion.section key="board" {...fadeUp}>
              {!isConnected
                ? <HeroSection onPost={() => setTab('create')} onBrowse={() => {}} />
                : <PageHeader label="Open Orders" sub="Claim an order to earn USDC. Payment releases from escrow once delivery is confirmed." />
              }
              <OrderBoard key={postOrderCreated} />
            </motion.section>
          )}

          {/* Post Order */}
          {tab === 'create' && (
            <motion.section key="create" {...fadeUp}>
              <PageHeader
                label="Post an Order"
                sub="Deposit USDC into escrow. A worker claims and fulfils it — payment releases automatically on delivery."
              />
              <div
                className="rounded-2xl p-5"
                style={{
                  background: 'rgba(255,255,255,0.82)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.68)',
                  boxShadow: '0 8px 32px rgba(18,45,69,0.07)',
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

          {/* My Orders */}
          {tab === 'my-orders' && (
            <motion.section key="my-orders" {...fadeUp}>
              <PageHeader
                label="My Orders"
                sub="Track orders you claimed as a worker, or orders you posted as a buyer."
              />
              <MyOrders />
            </motion.section>
          )}

          {/* Agent */}
          {tab === 'agent' && (
            <motion.section key="agent" {...fadeUp}>
              <PageHeader
                label="Autonomous Agent"
                sub="The platform wallet auto-creates orders, releases payments after delivery, and refunds stale escrows — no clicks needed."
              />
              <AgentStatus />
            </motion.section>
          )}

          {/* Settings */}
          {tab === 'settings' && (
            <motion.section key="settings" {...fadeUp}>
              <PageHeader
                label="Marketplace Settings"
                sub="Connect your marketplaces. Orders import automatically and post on-chain with one click."
              />
              <MarketplaceSettings />
              {/* Contract info pill */}
              <div
                className="mt-5 rounded-2xl p-4 flex flex-col gap-1.5"
                style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
              >
                <p className="text-xs font-semibold uppercase" style={{ color: 'var(--subtle)', letterSpacing: '0.08em' }}>
                  Escrow Contract · Arc Testnet
                </p>
                <a
                  href={`https://explorer.testnet.arc.io/address/${JARA_WORK_ESCROW.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono text-xs underline break-all"
                  style={{ color: 'var(--accent-hover)' }}
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

      {/* Bottom nav */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40"
        style={{
          background: 'rgba(255,255,255,0.94)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--border)',
        }}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-around px-2 py-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="relative flex flex-col items-center gap-0.5 min-w-[56px] min-h-[48px] justify-center px-3 py-2 rounded-xl transition-colors"
              style={{ color: tab === t.id ? 'var(--accent)' : 'var(--subtle)' }}
            >
              {tab === t.id && (
                <motion.div
                  layoutId="tab-bg"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: 'rgba(18,45,69,0.07)' }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
              <span className="relative z-10">{t.icon}</span>
              <span className="relative z-10 text-xs font-medium">{t.label}</span>
              {tab === t.id && (
                <motion.div
                  layoutId="tab-dot"
                  className="absolute bottom-1 w-1 h-1 rounded-full"
                  style={{ background: 'var(--accent)' }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
