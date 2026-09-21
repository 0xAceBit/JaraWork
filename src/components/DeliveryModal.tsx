/**
 * DeliveryModal — structured delivery proof submission
 *
 * Proof format stored on-chain (JSON string, max ~500 chars):
 *   {"type":"tracking","value":"1Z999AA10123456784","carrier":"UPS","note":"..."}
 *   {"type":"url","value":"https://drive.google.com/...","note":"..."}
 *   {"type":"ipfs","value":"QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco","note":"..."}
 *   {"type":"text","value":"Completed via phone call, ref: TKT-8821","note":""}
 *
 * The modal serialises to this format. Any consumer can call parseDeliveryProof()
 * to decode it — including OrderCard and the admin dispute panel.
 */
import { useState, useId } from 'react'
import { X, Package, Link2, Hash, FileText, CheckCircle, AlertCircle } from 'lucide-react'

// ─── Proof types ─────────────────────────────────────────────────────────────

export type ProofType = 'tracking' | 'url' | 'ipfs' | 'text'

export interface DeliveryProof {
  type: ProofType
  value: string
  carrier?: string   // only for tracking
  note?: string      // optional notes on any type
}

export function serializeProof(p: DeliveryProof): string {
  return JSON.stringify({ type: p.type, value: p.value, carrier: p.carrier ?? '', note: p.note ?? '' })
}

export function parseDeliveryProof(raw: string): DeliveryProof | null {
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as Record<string, unknown>
    if (typeof p.type !== 'string' || typeof p.value !== 'string') return null
    return {
      type: p.type as ProofType,
      value: p.value,
      carrier: typeof p.carrier === 'string' ? p.carrier : undefined,
      note: typeof p.note === 'string' ? p.note : undefined,
    }
  } catch {
    // Legacy free-form string — wrap as text
    return { type: 'text', value: raw }
  }
}

// ─── Per-type validation ──────────────────────────────────────────────────────

interface ValidationResult { valid: boolean; hint: string }

const TRACKING_PATTERNS: Record<string, RegExp> = {
  UPS:   /\b1Z[0-9A-Z]{16}\b/i,
  FedEx: /\b\d{12,22}\b/,
  USPS:  /\b9[0-9]{15,21}\b/,
  DHL:   /\b[0-9]{10,11}\b/,
}

function validateTracking(value: string, carrier: string): ValidationResult {
  const v = value.trim()
  if (!v) return { valid: false, hint: 'Enter a tracking number' }
  if (v.length < 6)  return { valid: false, hint: 'Too short to be a valid tracking number' }
  if (carrier && TRACKING_PATTERNS[carrier]) {
    const ok = TRACKING_PATTERNS[carrier].test(v)
    return ok
      ? { valid: true,  hint: `Looks like a valid ${carrier} number` }
      : { valid: false, hint: `Doesn't match the expected ${carrier} format` }
  }
  return { valid: true, hint: 'Tracking number accepted' }
}

function validateUrl(value: string): ValidationResult {
  const v = value.trim()
  if (!v) return { valid: false, hint: 'Enter a URL' }
  try {
    const url = new URL(v)
    if (url.protocol !== 'https:' && url.protocol !== 'http:')
      return { valid: false, hint: 'URL must start with https:// or http://' }
    return { valid: true, hint: 'Valid URL' }
  } catch {
    return { valid: false, hint: 'Not a valid URL — include https://' }
  }
}

function validateIpfs(value: string): ValidationResult {
  const v = value.trim()
  if (!v) return { valid: false, hint: 'Enter a CID or ipfs:// link' }
  const clean = v.replace(/^ipfs:\/\//i, '').replace(/^\/ipfs\//i, '')
  // CIDv0: Qm... 46 chars; CIDv1: bafy... 59+ chars
  const cid0 = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(clean)
  const cid1 = /^b[a-z2-7]{58,}$/.test(clean)
  if (!cid0 && !cid1) return { valid: false, hint: 'Paste a valid IPFS CID (Qm… or bafy…) or ipfs:// link' }
  return { valid: true, hint: 'Valid IPFS content identifier' }
}

function validateText(value: string): ValidationResult {
  const v = value.trim()
  if (!v) return { valid: false, hint: 'Enter a delivery description' }
  if (v.length < 10) return { valid: false, hint: `Too brief — add more detail (${v.length}/10 chars minimum)` }
  return { valid: true, hint: `${v.length} characters` }
}

// ─── Type config ──────────────────────────────────────────────────────────────

const PROOF_TYPES: {
  id: ProofType
  label: string
  icon: React.ReactNode
  inputType: 'text' | 'url' | 'textarea'
  placeholder: string
  description: string
}[] = [
  {
    id: 'tracking',
    label: 'Tracking Number',
    icon: <Package size={14} />,
    inputType: 'text',
    placeholder: '1Z999AA10123456784',
    description: 'A shipment tracking number from any carrier',
  },
  {
    id: 'url',
    label: 'Link / URL',
    icon: <Link2 size={14} />,
    inputType: 'url',
    placeholder: 'https://drive.google.com/…',
    description: 'A direct link to proof (Google Drive, Dropbox, screenshot, etc.)',
  },
  {
    id: 'ipfs',
    label: 'IPFS Hash',
    icon: <Hash size={14} />,
    inputType: 'text',
    placeholder: 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco',
    description: 'A content-addressed IPFS CID (Qm… or bafy…)',
  },
  {
    id: 'text',
    label: 'Description',
    icon: <FileText size={14} />,
    inputType: 'textarea',
    placeholder: 'Delivered to reception, signed by J. Smith, ref TKT-8821…',
    description: 'A written description of how delivery was completed',
  },
]

const CARRIERS = ['UPS', 'FedEx', 'USPS', 'DHL', 'Other']

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  orderTitle: string
  onSubmit: (proof: string) => void
  onClose: () => void
  isPending: boolean
  isConfirming: boolean
}

export default function DeliveryModal({ orderTitle, onSubmit, onClose, isPending, isConfirming }: Props) {
  const [proofType, setProofType] = useState<ProofType>('tracking')
  const [value, setValue] = useState('')
  const [carrier, setCarrier] = useState('UPS')
  const [note, setNote] = useState('')
  const busy = isPending || isConfirming
  const uid = useId()

  const typeConfig = PROOF_TYPES.find(t => t.id === proofType)!

  // Live validation
  const validation: ValidationResult =
    proofType === 'tracking' ? validateTracking(value, carrier) :
    proofType === 'url'      ? validateUrl(value) :
    proofType === 'ipfs'     ? validateIpfs(value) :
    validateText(value)

  const canSubmit = validation.valid && !busy

  function handleSubmit() {
    if (!canSubmit) return
    const proof: DeliveryProof = {
      type: proofType,
      value: value.trim(),
      carrier: proofType === 'tracking' ? carrier : undefined,
      note: note.trim() || undefined,
    }
    onSubmit(serializeProof(proof))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(18,45,69,0.50)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-md rounded-3xl shadow-2xl flex flex-col gap-0 overflow-hidden"
        style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <h3 className="display font-bold text-base" style={{ color: 'var(--ink)' }}>Submit Delivery Proof</h3>
            <p className="text-xs mt-0.5 truncate max-w-[260px]" style={{ color: 'var(--muted)' }}>{orderTitle}</p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-1.5 rounded-xl transition-colors"
            style={{ color: 'var(--muted)', background: 'var(--surface-muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-5 px-5 py-5">
          {/* Proof type selector */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--subtle)' }}>
              Proof Type
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PROOF_TYPES.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setProofType(t.id); setValue('') }}
                  disabled={busy}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all"
                  style={{
                    background: proofType === t.id ? 'var(--accent-light)' : 'var(--surface-muted)',
                    border: `1.5px solid ${proofType === t.id ? 'var(--accent)' : 'transparent'}`,
                    color: proofType === t.id ? 'var(--accent)' : 'var(--ink-2)',
                  }}
                >
                  <span style={{ color: proofType === t.id ? 'var(--accent)' : 'var(--muted)' }}>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>{typeConfig.description}</p>
          </div>

          {/* Carrier selector — only for tracking */}
          {proofType === 'tracking' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--subtle)' }}>
                Carrier
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {CARRIERS.map(c => (
                  <button
                    key={c}
                    onClick={() => setCarrier(c)}
                    disabled={busy}
                    className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                    style={{
                      background: carrier === c ? 'var(--accent)' : 'var(--surface-muted)',
                      color: carrier === c ? '#fff' : 'var(--ink-2)',
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Main input */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={uid} className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--subtle)' }}>
              {typeConfig.label}
            </label>
            {typeConfig.inputType === 'textarea' ? (
              <textarea
                id={uid}
                rows={3}
                placeholder={typeConfig.placeholder}
                value={value}
                onChange={e => setValue(e.target.value)}
                disabled={busy}
                className="w-full rounded-xl px-3 py-2.5 text-sm resize-none outline-none transition-all"
                style={{
                  background: 'var(--surface-muted)',
                  border: `1.5px solid ${value && validation.valid ? 'var(--success)' : value ? '#ef4444' : 'var(--border)'}`,
                  color: 'var(--ink)',
                }}
              />
            ) : (
              <input
                id={uid}
                type={typeConfig.inputType}
                placeholder={typeConfig.placeholder}
                value={value}
                onChange={e => setValue(e.target.value)}
                disabled={busy}
                className="w-full rounded-xl px-3 py-2.5 text-sm mono outline-none transition-all"
                style={{
                  background: 'var(--surface-muted)',
                  border: `1.5px solid ${value && validation.valid ? 'var(--success)' : value ? '#ef4444' : 'var(--border)'}`,
                  color: 'var(--ink)',
                }}
              />
            )}

            {/* Validation hint */}
            {value && (
              <div className="flex items-center gap-1.5">
                {validation.valid
                  ? <CheckCircle size={11} style={{ color: 'var(--success)', flexShrink: 0 }} />
                  : <AlertCircle size={11} style={{ color: '#ef4444', flexShrink: 0 }} />}
                <span
                  className="text-xs"
                  style={{ color: validation.valid ? 'var(--success)' : '#ef4444' }}
                >
                  {validation.hint}
                </span>
              </div>
            )}
          </div>

          {/* Optional note */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--subtle)' }}>
              Note <span style={{ color: 'var(--subtle)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </label>
            <input
              type="text"
              placeholder="Any additional context for the buyer…"
              value={note}
              onChange={e => setNote(e.target.value)}
              disabled={busy}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex gap-3 px-5 py-4"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-muted)' }}
        >
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 py-3 rounded-2xl text-sm font-semibold border transition-colors"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--ink-2)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
            style={{
              background: canSubmit
                ? 'linear-gradient(135deg, var(--accent) 0%, #c75f00 100%)'
                : 'var(--surface-muted)',
              color: canSubmit ? '#fff' : 'var(--muted)',
              boxShadow: canSubmit ? '0 4px 16px rgba(232,112,10,0.30)' : 'none',
            }}
          >
            {isPending ? 'Confirm in wallet…' : isConfirming ? 'Submitting…' : 'Submit Proof'}
          </button>
        </div>
      </div>
    </div>
  )
}
