import { motion } from 'framer-motion'
import { ShieldCheck, Zap, Clock, Bot, Globe, ArrowRight, Github } from 'lucide-react'
import { NetworkArc } from '@web3icons/react'

interface LandingPageProps {
  onEnterApp: () => void
}

function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function YoutubeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

function MailIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}

const FEATURES = [
  { icon: <ShieldCheck size={22} />, title: 'Trustless Escrow', desc: 'USDC locks the moment an order is posted. Funds release only on confirmed delivery.' },
  { icon: <Zap size={22} />, title: 'Instant Payments', desc: 'Sub-second finality on Arc Mainnet. Workers get paid the moment delivery is confirmed.' },
  { icon: <Globe size={22} />, title: 'No Bank Required', desc: 'Any wallet, anywhere in the world. Workers in emerging markets receive USDC instantly.' },
  { icon: <Bot size={22} />, title: 'Autonomous Agent', desc: 'A Circle-powered agent monitors marketplaces, creates orders, and releases payments automatically.' },
  { icon: <NetworkArc size={22} />, title: 'Multi-Marketplace', desc: 'eBay, Amazon, Shopify, Jumia and Jaramarket — all connected in one unified order board.' },
  { icon: <Clock size={22} />, title: 'Auto-Refund', desc: 'Stale orders are automatically refunded if no worker claims or delivery times out.' },
]

const STEPS = [
  { num: '01', title: 'Post an Order', desc: 'Seller posts an order from any connected marketplace. USDC locks into the smart contract.' },
  { num: '02', title: 'Claim the Work', desc: 'A worker anywhere in the world browses the board and claims an order that fits their skills.' },
  { num: '03', title: 'Deliver & Prove', desc: 'Worker completes the order and submits proof of delivery directly on chain.' },
  { num: '04', title: 'Get Paid', desc: 'Delivery is confirmed and USDC releases automatically to the worker. No intermediary needed.' },
]

const MARKETPLACES = ['eBay', 'Amazon', 'Shopify', 'Jumia', 'Jaramarket']

export default function LandingPage({ onEnterApp }: LandingPageProps) {
  return (
    <div style={{ background: 'var(--bg-gradient)', minHeight: '100dvh', color: 'var(--ink)' }}>

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(253,246,239,0.88)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div className="max-w-5xl mx-auto px-5 py-3.5 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <svg width="34" height="34" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="lg-lp" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f5a85c" />
                  <stop offset="100%" stopColor="#e8700a" />
                </linearGradient>
              </defs>
              <rect width="100" height="100" rx="22" fill="#1a0f00" />
              <text x="50" y="62" textAnchor="middle" fontSize="54" fontWeight="800" fontFamily="sans-serif" fill="url(#lg-lp)">J</text>
              <circle cx="68" cy="68" r="14" fill="#1a0f00" />
              <path d="M62 68 L66 72 L75 63" stroke="#4ade80" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <div>
              <p className="display font-bold text-sm" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>JaraWork</p>
              <p className="text-xs" style={{ color: 'var(--subtle)' }}>Order-to-Earner</p>
            </div>
          </div>
          {/* CTA */}
          <button
            onClick={onEnterApp}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 hover:opacity-90"
            style={{ background: 'linear-gradient(145deg, #e8700a, #c75f00)', color: '#fff', boxShadow: '0 3px 12px rgba(232,112,10,0.28)' }}
          >
            Launch App <ArrowRight size={14} />
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-5 pt-16 pb-14">
        <motion.div
          className="relative overflow-hidden rounded-3xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="absolute inset-0" style={{ background: 'linear-gradient(145deg, #e8700a 0%, #c75f00 55%, #a34d00 100%)' }} />
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,200,100,0.4) 0%, transparent 65%)', filter: 'blur(60px)' }} />
            <div style={{ position: 'absolute', bottom: '-20%', left: '5%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)', filter: 'blur(50px)' }} />
            <div style={{ position: 'absolute', top: '50%', right: '5%', transform: 'translateY(-50%)', width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.25)' }} />
            <div style={{ position: 'absolute', top: '50%', right: '5%', transform: 'translateY(-50%)', width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', margin: '20px' }} />
          </div>
          <div className="relative z-10 px-8 pt-12 pb-12 max-w-2xl">
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(0,0,0,0.18)', color: 'rgba(255,255,255,0.9)' }}>
                <NetworkArc size={13} /> Arc Mainnet
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: 'rgba(74,222,128,0.18)', color: '#4ade80' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} /> Live
              </span>
            </div>
            <p className="text-xs font-semibold mb-2 tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.7)' }}>Order-to-Earner Platform</p>
            <h1 className="display font-extrabold text-4xl md:text-5xl leading-tight mb-4" style={{ color: '#fff' }}>
              Work gets done.<br />Payment guaranteed.
            </h1>
            <p className="text-base mb-6" style={{ color: 'rgba(255,255,255,0.82)', maxWidth: 420 }}>
              Orders from eBay, Amazon, Shopify, Jumia and Jaramarket — fulfilled by workers worldwide, paid instantly in USDC. No intermediary. No frozen funds.
            </p>
            <div className="flex items-center gap-2 flex-wrap mb-6">
              {[{ icon: <ShieldCheck size={12} />, label: 'USDC Escrow' }, { icon: <Zap size={12} />, label: 'Auto-release' }, { icon: <Clock size={12} />, label: 'Sub-second finality' }].map(p => (
                <span key={p.label} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(0,0,0,0.22)', color: 'rgba(255,255,255,0.85)' }}>
                  {p.icon} {p.label}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={onEnterApp}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-base transition-all active:scale-95 hover:opacity-90"
                style={{ background: '#fff', color: '#c75f00', boxShadow: '0 4px 20px rgba(0,0,0,0.18)' }}
              >
                Launch App <ArrowRight size={16} />
              </button>
              <a
                href="https://github.com/0xAceBit/JaraWork"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-base transition-all active:scale-95 hover:opacity-80"
                style={{ background: 'rgba(0,0,0,0.25)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
              >
                <Github size={16} /> View Source
              </a>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Marketplaces */}
      <section className="max-w-5xl mx-auto px-5 pb-12">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.35 }}>
          <p className="text-center text-xs font-semibold tracking-widest uppercase mb-5" style={{ color: 'var(--subtle)' }}>Connected Marketplaces</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {MARKETPLACES.map(m => (
              <span key={m} className="px-4 py-2 rounded-full text-sm font-semibold" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', color: 'var(--ink-2)', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                {m}
              </span>
            ))}
          </div>
        </motion.div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-5 pb-16">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.35 }}>
          <p className="text-center text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--subtle)' }}>How It Works</p>
          <h2 className="display font-bold text-2xl text-center mb-8" style={{ color: 'var(--ink)' }}>Four steps. Fully onchain.</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.num}
                className="p-5 rounded-2xl"
                style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.06, duration: 0.3 }}
              >
                <span className="display font-black text-3xl" style={{ color: 'var(--accent)', opacity: 0.25 }}>{s.num}</span>
                <h3 className="display font-bold text-base mt-1 mb-1" style={{ color: 'var(--ink)' }}>{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-5 pb-16">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.35 }}>
          <p className="text-center text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--subtle)' }}>Platform Features</p>
          <h2 className="display font-bold text-2xl text-center mb-8" style={{ color: 'var(--ink)' }}>Built for trust. Designed for scale.</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                className="p-5 rounded-2xl"
                style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.05, duration: 0.3 }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                  {f.icon}
                </div>
                <h3 className="display font-bold text-sm mb-1" style={{ color: 'var(--ink)' }}>{f.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* CTA Banner */}
      <section className="max-w-5xl mx-auto px-5 pb-16">
        <motion.div
          className="relative overflow-hidden rounded-3xl px-8 py-12 text-center"
          style={{ background: 'linear-gradient(145deg, #e8700a 0%, #c75f00 55%, #a34d00 100%)' }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.35 }}
        >
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 80% 50%, rgba(255,200,100,0.3) 0%, transparent 60%)' }} />
          <div className="relative z-10">
            <h2 className="display font-extrabold text-3xl mb-3" style={{ color: '#fff' }}>Ready to earn?</h2>
            <p className="text-base mb-6" style={{ color: 'rgba(255,255,255,0.82)', maxWidth: 380, margin: '0 auto 24px' }}>
              Connect your wallet, browse open orders, and start earning USDC today.
            </p>
            <button
              onClick={onEnterApp}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-base transition-all active:scale-95 hover:opacity-90"
              style={{ background: '#fff', color: '#c75f00', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}
            >
              Launch JaraWork <ArrowRight size={16} />
            </button>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-5 pb-10">
        <div className="rounded-2xl px-6 py-6" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Brand */}
            <div className="text-center md:text-left">
              <p className="display font-bold text-sm" style={{ color: 'var(--ink)' }}>JaraWork</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Operated by Ace Corporation &copy; {new Date().getFullYear()}</p>
            </div>
            {/* Links */}
            <div className="flex items-center gap-4">
              <a
                href="https://x.com/JaraMarketPlC"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-9 h-9 rounded-xl transition-all hover:opacity-70 active:scale-95"
                style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                aria-label="X (Twitter)"
              >
                <XIcon size={16} />
              </a>
              <a
                href="https://www.youtube.com/@JaraMarketplace"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-9 h-9 rounded-xl transition-all hover:opacity-70 active:scale-95"
                style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: '#FF0000' }}
                aria-label="YouTube"
              >
                <YoutubeIcon size={16} />
              </a>
              <a
                href="mailto:legal@acecorporation.org"
                className="flex items-center justify-center w-9 h-9 rounded-xl transition-all hover:opacity-70 active:scale-95"
                style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--accent)' }}
                aria-label="Email"
              >
                <MailIcon size={16} />
              </a>
              <a
                href="https://github.com/0xAceBit/JaraWork"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-9 h-9 rounded-xl transition-all hover:opacity-70 active:scale-95"
                style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                aria-label="GitHub"
              >
                <Github size={16} />
              </a>
            </div>
            {/* Contract */}
            <div className="text-center md:text-right">
              <a
                href="https://arc.etherscan.io/address/0x52A34aD73fAe6Bd151F25F1BCDf13AA7781422d5"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono hover:opacity-70 transition-opacity"
                style={{ color: 'var(--accent)' }}
              >
                Contract: 0x52A3...422d5
              </a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
