import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Wallet, ArrowRight, CheckCircle2, X, Loader2 } from 'lucide-react'

type Screen = 'choose' | 'email' | 'sending' | 'success'

interface Props {
  onClose: () => void
  onEnterApp: () => void
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

export default function SignInPreview({ onClose, onEnterApp }: Props) {
  const [screen, setScreen] = useState<Screen>('choose')
  const [email, setEmail] = useState('')

  const [fakeAddress] = useState(() =>
    '0x' + Array.from({ length: 40 }, (_, i) =>
      '0123456789abcdef'[(i * 7 + 3) % 16]
    ).join('')
  )

  function handleSend() {
    if (!email.includes('@')) return
    setScreen('sending')
    setTimeout(() => setScreen('success'), 2200)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(26,12,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface-strong)',
          border: '1px solid var(--border-strong)',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '400px',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(26,12,0,0.22)',
        }}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #e8700a 0%, #c75f00 100%)',
          padding: '20px 24px 18px',
          position: 'relative',
        }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 14, right: 14,
              background: 'rgba(255,255,255,0.15)', border: 'none',
              borderRadius: '50%', width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'white',
            }}
          >
            <X size={14} />
          </button>
          <div className="flex items-center gap-2.5 mb-1">
            <svg width="28" height="28" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="lg-si" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#ffe0b2" />
                </linearGradient>
              </defs>
              <rect width="100" height="100" rx="22" fill="rgba(255,255,255,0.15)" />
              <text x="50" y="62" textAnchor="middle" fontSize="54" fontWeight="800" fontFamily="sans-serif" fill="url(#lg-si)">J</text>
              <circle cx="68" cy="68" r="14" fill="rgba(0,0,0,0.2)" />
              <path d="M62 68 L66 72 L75 63" stroke="#4ade80" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <span style={{ color: 'white', fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>JaraWork</span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.92)', fontSize: 13 }}>
            {screen === 'choose' && 'Get started in seconds'}
            {screen === 'email' && 'Enter your email'}
            {screen === 'sending' && 'Creating your wallet…'}
            {screen === 'success' && 'You\'re all set!'}
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          <AnimatePresence mode="wait">

            {/* SCREEN 1 — Choose */}
            {screen === 'choose' && (
              <motion.div key="choose" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}>

                {/* Connect Wallet */}
                <button
                  onClick={onEnterApp}
                  style={{
                    width: '100%', padding: '14px 16px',
                    background: 'linear-gradient(135deg, #fff8f0, #fff3e6)',
                    border: '1.5px solid var(--accent)',
                    borderRadius: 14, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 12,
                    marginBottom: 10,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'linear-gradient(135deg, #e8700a, #c75f00)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Wallet size={18} color="white" />
                  </div>
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', margin: 0 }}>Connect Wallet</p>
                    <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>MetaMask, WalletConnect, Coinbase</p>
                  </div>
                  <ArrowRight size={16} color="var(--accent)" />
                </button>

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border-strong)' }} />
                  <span style={{ fontSize: 11, color: 'var(--subtle)', fontWeight: 500 }}>or sign in without crypto</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border-strong)' }} />
                </div>

                {/* Email */}
                <button
                  onClick={() => setScreen('email')}
                  style={{
                    width: '100%', padding: '14px 16px',
                    background: 'var(--surface-muted)',
                    border: '1.5px solid var(--border-strong)',
                    borderRadius: 14, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 12,
                    marginBottom: 10,
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: '#1a1208',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Mail size={18} color="#f5a85c" />
                  </div>
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', margin: 0 }}>Continue with Email</p>
                    <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>A wallet is created automatically for you</p>
                  </div>
                  <ArrowRight size={16} color="var(--muted)" />
                </button>

                {/* Google — coming soon */}
                <button
                  disabled
                  style={{
                    width: '100%', padding: '14px 16px',
                    background: 'var(--surface-muted)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 14, cursor: 'not-allowed', opacity: 0.55,
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'white', border: '1px solid #e5e7eb',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <GoogleIcon />
                  </div>
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', margin: 0 }}>Continue with Google</p>
                    <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>Sign in with your Google account</p>
                  </div>
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                    background: 'var(--accent-light)', color: 'var(--accent)',
                    padding: '2px 7px', borderRadius: 6,
                  }}>SOON</span>
                </button>

                <p style={{ fontSize: 11, color: 'var(--subtle)', textAlign: 'center', marginTop: 16, lineHeight: 1.5 }}>
                  Powered by Circle Modular Wallets · Non-custodial · Your keys, your funds
                </p>
              </motion.div>
            )}

            {/* SCREEN 2 — Email input */}
            {screen === 'email' && (
              <motion.div key="email" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
                  Enter your email. We'll create a secure non-custodial wallet for you instantly — no seed phrase, no password.
                </p>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  style={{
                    width: '100%', padding: '13px 14px',
                    border: '1.5px solid var(--border-strong)',
                    borderRadius: 12, fontSize: 14,
                    background: 'var(--surface-muted)',
                    color: 'var(--ink)', outline: 'none',
                    boxSizing: 'border-box', marginBottom: 12,
                  }}
                  autoFocus
                />
                <button
                  onClick={handleSend}
                  disabled={!email.includes('@')}
                  style={{
                    width: '100%', padding: '13px',
                    background: email.includes('@')
                      ? 'linear-gradient(135deg, #e8700a, #c75f00)'
                      : 'var(--border)',
                    border: 'none', borderRadius: 12,
                    color: 'white', fontWeight: 700, fontSize: 14,
                    cursor: email.includes('@') ? 'pointer' : 'not-allowed',
                    marginBottom: 10,
                  }}
                >
                  Create My Wallet
                </button>
                <button
                  onClick={() => setScreen('choose')}
                  style={{
                    width: '100%', padding: '10px',
                    background: 'none', border: 'none',
                    color: 'var(--muted)', fontSize: 13, cursor: 'pointer',
                  }}
                >
                  ← Back
                </button>
              </motion.div>
            )}

            {/* SCREEN 3 — Sending / creating */}
            {screen === 'sending' && (
              <motion.div key="sending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
                style={{ textAlign: 'center', padding: '24px 0' }}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  style={{ display: 'inline-block', marginBottom: 16 }}
                >
                  <Loader2 size={40} color="var(--accent)" />
                </motion.div>
                <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 6 }}>Setting up your wallet</p>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>This takes about 2 seconds…</p>
              </motion.div>
            )}

            {/* SCREEN 4 — Success */}
            {screen === 'success' && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
                style={{ textAlign: 'center' }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
                  style={{ marginBottom: 12 }}
                >
                  <CheckCircle2 size={52} color="#1a6e3c" strokeWidth={1.8} />
                </motion.div>
                <p style={{ fontWeight: 800, fontSize: 18, color: 'var(--ink)', marginBottom: 6, letterSpacing: '-0.02em' }}>Wallet created!</p>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Your non-custodial wallet is ready. You can receive USDC payments directly.</p>
                <div style={{
                  background: 'var(--surface-muted)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 10, padding: '10px 14px',
                  marginBottom: 20,
                }}>
                  <p style={{ fontSize: 10, color: 'var(--subtle)', marginBottom: 3, fontWeight: 600, letterSpacing: '0.06em' }}>YOUR WALLET ADDRESS</p>
                  <p style={{ fontSize: 11, color: 'var(--ink)', fontFamily: 'monospace', wordBreak: 'break-all', margin: 0 }}>{fakeAddress}</p>
                </div>
                <button
                  onClick={onEnterApp}
                  style={{
                    width: '100%', padding: '13px',
                    background: 'linear-gradient(135deg, #e8700a, #c75f00)',
                    border: 'none', borderRadius: 12,
                    color: 'white', fontWeight: 700, fontSize: 14,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  Browse Orders <ArrowRight size={16} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
