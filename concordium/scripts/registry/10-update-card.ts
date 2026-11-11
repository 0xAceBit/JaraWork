/**
 * Step 10: list the MCP service and x402 support in the Agent Card.
 * Changes exactly two fields (services, x402Support) and nothing else, and refuses to run if
 * re-serializing the current card would change any other byte. Rerunnable.
 * Usage: node scripts/registry/10-update-card.ts [--x402 true|false]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { config, flagValue, paths, readState, sha256Hex, show, writeState } from './lib.ts'

const x402 = (flagValue('--x402') ?? 'true') === 'true'
const before = readFileSync(paths.cardFile, 'utf8')
const card = JSON.parse(before) as Record<string, unknown>

// The file must round-trip exactly, so the only bytes that change are the two fields we add.
const style = (value: unknown): string => JSON.stringify(value, null, 2)
if (style(card) !== before) {
  throw new Error('The current card does not re-serialize to identical bytes; refusing to rewrite it.')
}

const mcp = { name: 'MCP', endpoint: `${config.baseUrl}/mcp`, version: '2025-06-18' }
const existing = Array.isArray(card.services) ? (card.services as { name?: string }[]).filter((s) => s.name !== 'MCP') : []
card.services = [...existing, mcp]
card.x402Support = x402

const after = style(card)
const beforeSha = sha256Hex(before)
const afterSha = sha256Hex(after)
show('CARD CHANGE', {
  addedOrChanged: { services: card.services, x402Support: card.x402Support },
  bytesBefore: Buffer.byteLength(before),
  bytesAfter: Buffer.byteLength(after),
  sha256Before: beforeSha,
  sha256After: afterSha,
})
if (afterSha === beforeSha) {
  console.log('\nNo change: the card already lists this MCP service and x402Support value.')
} else {
  writeFileSync(paths.cardFile, Buffer.from(after, 'utf8'))
  writeState({ previousCardSha256: readState().cardSha256 ?? beforeSha, cardSha256: afterSha })
  console.log('\nWrote public/agent-card.json and saved the new hash. Next: commit and push so Render serves it.')
}
