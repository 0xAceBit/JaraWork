import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wallet, ArrowRight, CheckCircle2, X, Loader2, Fingerprint, AlertCircle } from 'lucide-react'
import { createPublicClient } from 'viem'
import { arc } from 'viem/chains'
import {
  WebAuthnMode,
  toCircleSmartAccount,
  toModularTransport,
  toPasskeyTransport,
  toWebAuthnCredential,
} from '@circle-fin/modular-wallets-core'
import { createBundlerClient, toWebAuthnAccount, type WebAuthnAccount } from 'viem/account-abstraction'

type P256Credential = Awaited<ReturnType<typeof toWebAuthnCredential>>

type Screen = 'choose' | 'passkey-register' | 'passkey-login' | 'creating' | 'success' | 'error'

interface Props {
  onClose: () => void
  onConnectWallet: () => void
  onEnterApp: (address: string, credential: P256Credential) => void
}

function JaraLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="22" fill="#1a0f00"/>
      <text x="50" y="62" textAnchor="middle" fontSize="52" fontWeight="bold" fill="#f97316" fontFamily="Arial">J</text>
      <circle cx="72" cy="28" r="14" fill="#16a34a"/>
      <path d="M66 28l4 4 8-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function SignIn({ onClose, onConnectWallet, onEnterApp }: Props) {
  const [screen, setScreen] = useState<Screen>('choose')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [walletAddress, setWalletAddress] = useState('')

  // Lazy-initialize transports so missing env vars don't crash the module on import
  const clients = useMemo(() => {
    const clientKey = import.meta.env.VITE_CLIENT_KEY as string | undefined
    const clientUrl = import.meta.env.VITE_CLIENT_URL as string | undefined
    if (!clientKey || !clientUrl) return null
    const passkeyTransport = toPasskeyTransport(clientUrl, clientKey)
    const modularTransport = toModularTransport(`${clientUrl}/arc`, clientKey)
    const publicClient = createPublicClient({ chain: arc, transport: modularTransport })
    const bundlerClient = createBundlerClient({ chain: arc, transport: modularTransport })
    return { passkeyTransport, publicClient, bundlerClient }
  }, [])

  // Restore existing session on mount
  useEffect(() => {
    const stored = localStorage.getItem('jw_passkey_credential')
    if (stored && clients) {
      const credential = JSON.parse(stored) as P256Credential
      setScreen('creating')
      restoreSession(credential)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients])

  async function restoreSession(credential: P256Credential) {
    if (!clients) { setScreen('choose'); return }
    try {
      const account = await toCircleSmartAccount({
        client: clients.publicClient,
        owner: toWebAuthnAccount({ credential }),
      })
      setWalletAddress(account.address)
      setScreen('success')
      setTimeout(() => onEnterApp(account.address, credential), 1200)
    } catch {
      localStorage.removeItem('jw_passkey_credential')
      setScreen('choose')
    }
  }

  async function handleRegister() {
    if (!username.trim() || !clients) return
    setScreen('creating')
    setError('')
    try {
      const credential = await toWebAuthnCredential({
        transport: clients.passkeyTransport,
        mode: WebAuthnMode.Register,
        username: username.trim(),
      })
      localStorage.setItem('jw_passkey_credential', JSON.stringify(credential))
      const account = await toCircleSmartAccount({
        client: clients.publicClient,
        owner: toWebAuthnAccount({ credential }),
      })
      setWalletAddress(account.address)
      setScreen('success')
      setTimeout(() => onEnterApp(account.address, credential), 1500)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('InvalidStateError') || msg.includes('already registered')) {
        handleLogin()
      } else {
        setError(msg.includes('NotAllowedError') ? 'Passkey prompt was cancelled. Try again.' : msg)
        setScreen('error')
      }
    }
  }

  async function handleLogin() {
    if (!clients) return
    setScreen('creating')
    setError('')
    try {
      const credential = await toWebAuthnCredential({
        transport: clients.passkeyTransport,
        mode: WebAuthnMode.Login,
      })
      localStorage.setItem('jw_passkey_credential', JSON.stringify(credential))
      const account = await toCircleSmartAccount({
        client: clients.publicClient,
        owner: toWebAuthnAccount({ credential }),
      })
      setWalletAddress(account.address)
      setScreen('success')
      setTimeout(() => onEnterApp(account.address, credential), 1500)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg.includes('NotAllowedError') ? 'Passkey prompt was cancelled. Try again.' : msg)
      setScreen('error')
    }
  }

  // If Circle keys aren't configured, show a graceful fallback
  if (!clients) {
    return (
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <div className="h-1.5 w-full bg-gradient-to-r from-orange-400 via-amber-500 to-orange-600" />
            <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors z-10">
              <X size={16} />
            </button>
            <div className="px-6 pb-8 pt-6 flex flex-col items-center text-center">
              <JaraLogo />
              <h2 className="text-lg font-bold text-stone-900 mt-4 mb-2">Passkey sign-in unavailable</h2>
              <p className="text-sm text-stone-500 mb-5">Use Connect Wallet to get started.</p>
              <button
                onClick={() => { onClose(); onConnectWallet() }}
                className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl border border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50 transition-all"
              >
                <Wallet size={20} className="text-stone-600" />
                <span className="font-semibold text-stone-900 text-sm">Connect Wallet</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          {/* Amber top bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-orange-400 via-amber-500 to-orange-600" />

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors z-10"
          >
            <X size={16} />
          </button>

          <div className="px-6 pb-6 pt-5">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <JaraLogo />
              <div>
                <div className="font-bold text-stone-900 text-sm">JaraWork</div>
                <div className="text-xs text-stone-500">Order-to-Earner</div>
              </div>
            </div>

            {/* Screen: Choose */}
            {screen === 'choose' && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <h2 className="text-xl font-bold text-stone-900 mb-1">Get started</h2>
                <p className="text-sm text-stone-500 mb-5">Claim orders and earn USDC worldwide.</p>

                {/* Passkey option */}
                <button
                  onClick={() => setScreen('passkey-register')}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-orange-200 bg-orange-50 hover:border-orange-400 hover:bg-orange-100 transition-all mb-3 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-600 transition-colors">
                    <Fingerprint size={20} className="text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-semibold text-stone-900 text-sm">Sign in with Passkey</div>
                    <div className="text-xs text-stone-500">Face ID, fingerprint or device PIN. No seed phrase.</div>
                  </div>
                  <ArrowRight size={16} className="text-orange-400 group-hover:text-orange-600 transition-colors" />
                </button>

                <p className="text-center text-xs text-stone-400 mb-3">
                  Already have a passkey?{' '}
                  <button onClick={handleLogin} className="text-orange-500 hover:underline font-medium">Sign in</button>
                </p>

                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 h-px bg-stone-200" />
                  <span className="text-xs text-stone-400">or</span>
                  <div className="flex-1 h-px bg-stone-200" />
                </div>

                {/* Connect Wallet option */}
                <button
                  onClick={() => { onClose(); onConnectWallet() }}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl border border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center flex-shrink-0 group-hover:bg-stone-200 transition-colors">
                    <Wallet size={20} className="text-stone-600" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-semibold text-stone-900 text-sm">Connect Wallet</div>
                    <div className="text-xs text-stone-500">MetaMask, WalletConnect, Coinbase</div>
                  </div>
                  <ArrowRight size={16} className="text-stone-400 group-hover:text-stone-600 transition-colors" />
                </button>

                <p className="text-center text-xs text-stone-400 mt-4">
                  Powered by <span className="font-medium text-stone-500">Circle Modular Wallets</span> · Non-custodial
                </p>
              </motion.div>
            )}

            {/* Screen: Passkey register */}
            {screen === 'passkey-register' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <button onClick={() => setScreen('choose')} className="text-xs text-stone-400 hover:text-stone-600 mb-4 flex items-center gap-1">
                  ← Back
                </button>
                <h2 className="text-xl font-bold text-stone-900 mb-1">Create your wallet</h2>
                <p className="text-sm text-stone-500 mb-5">Your device will ask you to save a passkey. No password needed.</p>

                <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Your name or username</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRegister()}
                  placeholder="e.g. Oodo Malachi"
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent mb-4"
                  autoFocus
                />

                <button
                  onClick={handleRegister}
                  disabled={!username.trim()}
                  className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-stone-200 disabled:text-stone-400 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Fingerprint size={18} />
                  Create wallet with Passkey
                </button>

                <p className="text-xs text-stone-400 text-center mt-3">
                  Your wallet is created on Arc Mainnet. First transaction gas is sponsored.
                </p>
              </motion.div>
            )}

            {/* Screen: Creating / loading */}
            {screen === 'creating' && (
              <motion.div
                className="flex flex-col items-center py-8"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              >
                <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-4">
                  <Loader2 size={28} className="text-orange-500 animate-spin" />
                </div>
                <p className="font-semibold text-stone-900 text-sm mb-1">Creating your wallet</p>
                <p className="text-xs text-stone-500 text-center">Registering on Arc Mainnet via Circle...</p>
              </motion.div>
            )}

            {/* Screen: Success */}
            {screen === 'success' && (
              <motion.div
                className="flex flex-col items-center py-6"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              >
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <CheckCircle2 size={28} className="text-green-500" />
                </div>
                <p className="font-bold text-stone-900 text-lg mb-1">Wallet ready!</p>
                <p className="text-xs text-stone-500 mb-3 text-center">Your on-chain wallet has been created.</p>
                <div className="bg-stone-100 rounded-xl px-3 py-2 mb-4">
                  <p className="text-xs font-mono text-stone-600 break-all text-center">
                    {walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}
                  </p>
                </div>
                <p className="text-xs text-stone-400 text-center">Taking you to the order board...</p>
              </motion.div>
            )}

            {/* Screen: Error */}
            {screen === 'error' && (
              <motion.div
                className="flex flex-col items-center py-6"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              >
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                  <AlertCircle size={28} className="text-red-500" />
                </div>
                <p className="font-bold text-stone-900 text-sm mb-2">Something went wrong</p>
                <p className="text-xs text-stone-500 text-center mb-4">{error}</p>
                <button
                  onClick={() => setScreen('choose')}
                  className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors"
                >
                  Try again
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
