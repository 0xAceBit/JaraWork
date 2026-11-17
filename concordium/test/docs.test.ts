/**
 * The documents must not claim anything the code does not back. These tests read the README and the two
 * docs it leans on and fail if they name a file, route, tool, setting or default that does not exist.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { resolveServiceMode } from '../src/payments/config.ts'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const read = (path: string): string => readFileSync(join(root, path), 'utf8')
const DOCS = ['README.md', 'docs/architecture.md', 'docs/demo-video-script.md']

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`
    if (statSync(join(root, rel)).isDirectory()) out.push(...walk(rel))
    else if (name.endsWith('.ts')) out.push(rel)
  }
  return out
}
const codeFiles = [...walk('src'), ...walk('scripts'), 'server.mjs']
const allCode = codeFiles.map(read).join('\n')

/** The part of the README between two headings. */
function section(text: string, from: string, to: string): string {
  const start = text.indexOf(from)
  const end = text.indexOf(to, start + from.length)
  assert.ok(start >= 0 && end > start, `README must contain the headings "${from}" and "${to}"`)
  return text.slice(start, end)
}

void describe('docs: every claim points at something real', () => {
  void it('every path named in the docs exists', () => {
    const missing: string[] = []
    for (const doc of DOCS) {
      const text = read(doc)
      const targets = new Set<string>()
      for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
        const target = (m[1] ?? '').split('#')[0] ?? ''
        if (target !== '' && !target.startsWith('http')) targets.add(resolve(root, dirname(doc), target))
      }
      for (const m of text.matchAll(/`((?:src|scripts|test|trajectory|docs|public)\/[A-Za-z0-9_.\-/]*|server\.mjs|package\.json)`/g)) targets.add(resolve(root, m[1] ?? ''))
      for (const target of targets) if (!existsSync(target)) missing.push(`${doc}: ${target.replace(root, '.')}`)
    }
    assert.deepEqual(missing, [])
  })

  void it('every setting the code reads is documented, and every documented setting is read by the code', () => {
    const read1 = [...allCode.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)|\benv\.([A-Z][A-Z0-9_]*)|micro\(env, '([A-Z0-9_]+)'/g)]
    const inCode = new Set(read1.map((m) => m[1] ?? m[2] ?? m[3] ?? ''))
    const settings = section(read('README.md'), '### Settings', '## Safety rules enforced in code')
    const documented = new Set([...settings.matchAll(/`([A-Z][A-Z0-9_]{2,})`/g)].map((m) => m[1] ?? ''))
    assert.deepEqual([...inCode].filter((n) => !documented.has(n)).sort(), [], 'read by the code but not documented')
    // A name chosen at run time (for example requireEnv(signingEnv)) still appears as a quoted string in the code.
    assert.deepEqual([...documented].filter((n) => !inCode.has(n) && !allCode.includes(`'${n}'`)).sort(), [], 'documented but never read by the code')
  })

  void it('the documented routes are exactly the routes the server has', () => {
    const inCode = new Set([...read('server.mjs').matchAll(/path === '(\/[^']*)'/g)].map((m) => m[1] ?? ''))
    const table = section(read('README.md'), '### Routes', '### Settings')
    const documented = new Set([...table.matchAll(/^\| `(\/[^`]*)` \|/gm)].map((m) => m[1] ?? ''))
    assert.deepEqual([...documented].sort(), [...inCode].sort())
  })

  void it('the tool and the registry reads named in the README exist in the code', () => {
    const readme = read('README.md')
    assert.ok(read('src/service/mcp.ts').includes("'validate_delivery_proof'"))
    const row = readme.split('\n').find((l) => l.includes('Reads used at run time')) ?? ''
    const names = [...row.matchAll(/`([a-z_]+)`/g)].map((m) => m[1] ?? '').filter((n) => n.includes('_') || n === 'agent_of')
    assert.ok(names.length >= 5, 'the README should list the registry reads')
    for (const name of names) assert.ok(allCode.includes(`'${name}'`), `${name} is not called anywhere in the code`)
  })

  void it('every test file is in the npm test script, and every npm script the docs use exists', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> }
    const testFiles = readdirSync(join(root, 'test')).filter((f) => f.endsWith('.test.ts'))
    for (const file of testFiles) assert.ok((pkg.scripts.test ?? '').includes(`test/${file}`), `${file} is not run by npm test`)
    for (const doc of DOCS) {
      for (const m of read(doc).matchAll(/npm run ([a-z:-]+)/g)) assert.ok(pkg.scripts[m[1] ?? ''] !== undefined, `${doc}: npm run ${m[1]} does not exist`)
      if (/npm (test|start)\b/.test(read(doc))) assert.ok(pkg.scripts.test !== undefined && pkg.scripts.start !== undefined)
    }
  })
})

void describe('docs: the numbers and the evidence', () => {
  void it('the defaults in the README are the defaults in the code', () => {
    const mode = resolveServiceMode({ CCD_FACILITATOR_PRIVATE_KEY: 'a'.repeat(64), X402_ALLOW_EPHEMERAL_LEDGER: 'true' })
    assert.equal(mode.mode, 'paid')
    if (mode.mode !== 'paid') return
    const c = mode.config
    const expected: [string, string | number | bigint][] = [
      ['PRICE_MICRO_CCD', c.priceMicro],
      ['ESTIMATED_SPONSOR_FEE_MICRO', c.estimatedSponsorFeeMicro],
      ['PAYER_DAILY_MAX_MICRO', c.payerDailyMaxMicro],
      ['SPONSOR_DAILY_BUDGET_MICRO', c.sponsorDailyBudgetMicro],
      ['X402_MAX_TIMEOUT_SECONDS', c.maxTimeoutSeconds],
      ['X402_MAX_UNCHARGED_PER_MIN', c.maxUnchargedPerMinute],
      ['X402_LEDGER_FILE', c.ledgerFile],
      ['CCD_GRPC_HOST', c.grpcHost],
    ]
    const readme = read('README.md')
    for (const [name, value] of expected) {
      const row = readme.split('\n').find((l) => l.startsWith('| `') && l.includes(`\`${name}\``)) ?? ''
      assert.ok(row.includes(`(${String(value)}`) || row.includes(`\`${String(value)}\``) || row.includes(String(value)), `${name}: README does not state the real default ${String(value)}`)
    }
    // The rate-limit defaults live inline in server.mjs.
    const server = read('server.mjs')
    for (const m of server.matchAll(/([A-Z_]+_PER_MIN) \?\? (\d+)/g)) {
      const row = readme.split('\n').find((l) => l.startsWith('| `') && l.includes(`\`${m[1] ?? ''}\``)) ?? ''
      assert.ok(row.includes(m[2] ?? '#'), `${m[1]}: README does not state the real default ${m[2]}`)
    }
  })

  void it('the evidence file is well formed and every hash the docs show is in it', () => {
    const evidence = JSON.parse(read('trajectory/evidence.json')) as { accounts: Record<string, string>; transactions: { hash: string; expect: { sender: string } }[] }
    const hashes = evidence.transactions.map((t) => t.hash)
    for (const h of hashes) assert.match(h, /^[0-9a-f]{64}$/)
    assert.equal(new Set(hashes).size, hashes.length, 'duplicate hash')
    for (const t of evidence.transactions) assert.ok(evidence.accounts[t.expect.sender] !== undefined, `unknown account ${t.expect.sender}`)
    const recorded = read('trajectory/judge-demo-2026-11-17.txt')
    for (const doc of DOCS) {
      for (const m of read(doc).matchAll(/\b[0-9a-f]{64}\b/g)) assert.ok(hashes.includes(m[0]) || recorded.includes(m[0]), `${doc}: ${m[0]} is not in the evidence`)
    }
    // The four payments in the evidence are exactly the four in the recorded demo.
    for (const m of recorded.matchAll(/payment tx: ([0-9a-f]{64})/g)) assert.ok(hashes.includes(m[1] ?? ''), `recorded payment ${m[1]} is missing from the evidence`)
  })

  void it('the style rules hold: Node only, no em dashes, the Arc Studio line is present', () => {
    for (const doc of DOCS) {
      const text = read(doc)
      assert.ok(!text.includes('\u2014'), `${doc} contains an em dash`)
      assert.ok(!/\bBun\b/.test(text), `${doc} mentions another runtime`)
    }
    assert.ok(read('README.md').includes('Built with [Arc Studio](https://studio.arc.io)'))
  })
})
