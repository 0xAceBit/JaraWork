/**
 * Dev-only status badge for the Concordium service (concordium-hackathon branch).
 * Plain DOM, no React, so it never touches the JaraWork component tree.
 * Loaded from src/main.tsx behind import.meta.env.DEV, so it is removed from production builds.
 */
type Health = { ok: boolean; runtime?: string; network?: string; error?: string }
type Chain = { ok: boolean; lastFinalizedBlockHeight?: string; error?: string }

const POLL_MS = 15_000

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { accept: 'application/json' } })
  return (await res.json()) as T
}

function mount(): void {
  if (document.getElementById('ccd-dev-badge')) return

  const root = document.createElement('div')
  root.id = 'ccd-dev-badge'
  root.style.cssText = [
    'position:fixed',
    'left:12px',
    'bottom:12px',
    'z-index:99999',
    'max-width:300px',
    'padding:10px 12px',
    'border-radius:12px',
    'background:#14121a',
    'color:#e8e6ef',
    'font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace',
    'box-shadow:0 6px 24px rgba(0,0,0,.35)',
    'border:1px solid #2c2838',
  ].join(';')

  const title = document.createElement('div')
  title.style.cssText = 'font-weight:700;margin-bottom:4px;display:flex;align-items:center;gap:6px'
  const dot = document.createElement('span')
  dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:#888;display:inline-block'
  const label = document.createElement('span')
  label.textContent = 'Concordium service (dev)'
  title.append(dot, label)

  const body = document.createElement('div')
  body.textContent = 'checking...'

  root.append(title, body)
  document.body.append(root)

  async function refresh(): Promise<void> {
    try {
      const [health, chain] = await Promise.all([
        getJson<Health>('/concordium/health'),
        getJson<Chain>('/concordium/chain'),
      ])
      const up = health.ok && chain.ok
      dot.style.background = up ? '#2fbf71' : '#e5a03a'
      body.textContent = [
        `runtime: ${health.runtime ?? 'unknown'}`,
        `network: ${health.network ?? 'unknown'}`,
        chain.ok ? `testnet block: ${chain.lastFinalizedBlockHeight}` : `chain error: ${chain.error ?? 'unknown'}`,
      ].join('\n')
      body.style.whiteSpace = 'pre'
    } catch (err) {
      dot.style.background = '#e5484d'
      body.style.whiteSpace = 'normal'
      body.textContent = `unreachable: ${err instanceof Error ? err.message : String(err)}`
    }
  }

  void refresh()
  window.setInterval(() => void refresh(), POLL_MS)
}

mount()
