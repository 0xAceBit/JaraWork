import { useState } from 'react'
import TermsOfService from './TermsOfService'
import PrivacyPolicy from './PrivacyPolicy'

export default function Footer() {
  const [modal, setModal] = useState<'terms' | 'privacy' | null>(null)
  const year = new Date().getFullYear()

  return (
    <>
      <footer
        className="w-full text-center py-4 px-4 pb-24"
        style={{ color: 'var(--subtle)', fontSize: '0.72rem' }}
      >
        <p className="mb-1">
          Operated by{' '}
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Ace Corporation</span>
          {' '}— JaraWork Order-to-Earner Marketplace
        </p>
        <p className="mb-1.5">
          &copy; {year} Ace Corporation. All rights reserved.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setModal('terms')}
            className="underline underline-offset-2 hover:opacity-80 transition-opacity"
            style={{ color: 'var(--accent)' }}
          >
            Terms of Service
          </button>
          <span style={{ color: 'var(--border)' }}>|</span>
          <button
            onClick={() => setModal('privacy')}
            className="underline underline-offset-2 hover:opacity-80 transition-opacity"
            style={{ color: 'var(--accent)' }}
          >
            Privacy Policy
          </button>
        </div>
      </footer>

      {/* Modal overlay */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setModal(null)}
        >
          <div
            className="w-full sm:max-w-2xl max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold" style={{ color: 'var(--fg)' }}>
                {modal === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
              </h2>
              <button
                onClick={() => setModal(null)}
                className="text-2xl leading-none hover:opacity-70 transition-opacity"
                style={{ color: 'var(--subtle)' }}
              >
                &times;
              </button>
            </div>
            {modal === 'terms' ? <TermsOfService /> : <PrivacyPolicy />}
          </div>
        </div>
      )}
    </>
  )
}
