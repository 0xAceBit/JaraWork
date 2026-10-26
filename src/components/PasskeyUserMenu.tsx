import { useState, useRef, useEffect } from 'react'

interface Props {
  address: string
  onDisconnect: () => void
}

export default function PasskeyUserMenu({ address, onDisconnect }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
        style={{ background: 'rgba(232,112,10,0.10)', color: 'var(--accent)' }}
      >
        <span className="w-2 h-2 rounded-full bg-green-500 inline-block shrink-0" />
        <span>{address.slice(0, 6)}...{address.slice(-4)}</span>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-48 rounded-2xl shadow-xl border z-50 overflow-hidden"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          {/* Address row */}
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--subtle)' }}>Passkey wallet</p>
            <p className="text-xs font-mono font-semibold" style={{ color: 'var(--ink)' }}>
              {address.slice(0, 10)}...{address.slice(-6)}
            </p>
          </div>

          {/* Copy address */}
          <button
            onClick={() => { navigator.clipboard.writeText(address); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium transition-colors hover:bg-black/5 text-left"
            style={{ color: 'var(--ink)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy address
          </button>

          {/* Disconnect */}
          <button
            onClick={() => { setOpen(false); onDisconnect() }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium transition-colors hover:bg-red-50 text-left border-t"
            style={{ color: '#dc2626', borderColor: 'var(--border)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}
