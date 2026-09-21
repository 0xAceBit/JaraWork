import { useState } from 'react'
import { X } from 'lucide-react'

interface Props {
  orderTitle: string
  onSubmit: (proof: string) => void
  onClose: () => void
  isPending: boolean
  isConfirming: boolean
}

export default function DeliveryModal({ orderTitle, onSubmit, onClose, isPending, isConfirming }: Props) {
  const [proof, setProof] = useState('')
  const busy = isPending || isConfirming

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(18,45,69,0.4)', backdropFilter: 'blur(4px)' }}>
      <div
        style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
        className="w-full max-w-md rounded-2xl p-6 shadow-xl flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="display font-semibold text-base" style={{ color: 'var(--ink)' }}>Submit Delivery</h3>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: 'var(--muted)' }}>
            <X size={18} />
          </button>
        </div>

        <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
          For: <strong>{orderTitle}</strong>
        </p>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            Delivery Proof
          </label>
          <textarea
            rows={3}
            placeholder="Paste an IPFS hash, URL, tracking number, or any delivery reference…"
            value={proof}
            onChange={(e) => setProof(e.target.value)}
            disabled={busy}
            className="w-full rounded-xl p-3 text-sm resize-none outline-none"
            style={{
              background: 'var(--surface-muted)',
              border: '1px solid var(--border)',
              color: 'var(--ink)',
            }}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--ink-2)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(proof.trim())}
            disabled={!proof.trim() || busy}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={{
              background: proof.trim() && !busy ? '#7c3aed' : 'var(--surface-muted)',
              color: proof.trim() && !busy ? '#fff' : 'var(--muted)',
            }}
          >
            {isPending ? 'Confirm in wallet…' : isConfirming ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}
