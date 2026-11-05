/**
 * Step 1: build the Agent Card with the hosted registry tool and save the EXACT
 * returned bytes to public/agent-card.json (the file the service will serve).
 *
 * Usage: node scripts/registry/01-build-card.ts
 * Rerunnable: it overwrites the card file. Refuses once a token exists (use 06 then).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { callTool, cardUrl, config, hasFlag, paths, readState, sha256Hex, show, writeState } from './lib.ts'

// Top-level keys in the docs' example card (docs.concordium.com ... agent-card.html).
const DOC_EXAMPLE_KEYS = [
  'type', 'name', 'description', 'image', 'version', 'provider', 'supportedInterfaces', 'capabilities',
  'defaultInputModes', 'defaultOutputModes', 'skills', 'services', 'x402Support', 'active', 'registrations',
]

if (readState().tokenId && !hasFlag('--force')) {
  console.error('A token already exists. Use 06-build-badge.ts to change the card, or pass --force.')
  process.exit(1)
}

const result = await callTool('build_agent_card', {
  network: config.network,
  name: 'JaraWork Proof Validator',
  description:
    'Checks delivery proofs (tracking numbers, links and IPFS content hashes) for JaraWork escrow orders and returns pass or fail with a reason. Concordium testnet demo, work in progress.',
  agent_uri: cardUrl(),
  owner_account: config.owner,
  version: '0.1.0',
  skills: [
    {
      id: 'validate_delivery_proof',
      name: 'Validate delivery proof',
      description: 'Checks one delivery proof and returns pass or fail with a reason.',
      tags: ['escrow', 'delivery', 'validation'],
    },
  ],
  provider: { organization: 'Ace Corporation', url: 'https://jarawork.online' },
})

const cardJson = result.agent_card_json
const returnedHash = result.metadata_hash_hex
if (typeof cardJson !== 'string' || typeof returnedHash !== 'string') throw new Error('Unexpected response shape from build_agent_card')

// The exact bytes: UTF-8 of the returned string, no newline added.
const bytes = Buffer.from(cardJson, 'utf8')
const computed = sha256Hex(bytes)
mkdirSync(dirname(paths.cardFile), { recursive: true })
writeFileSync(paths.cardFile, bytes)
writeState({ agentUri: cardUrl(), cardSha256: computed })

const card = JSON.parse(cardJson) as Record<string, unknown>
const extensions = ((card.capabilities as { extensions?: { uri?: string }[] } | undefined)?.extensions ?? []).map((e) => e.uri)

show('CHECKS', {
  savedTo: 'public/agent-card.json',
  byteLength: bytes.length,
  endsWithNewline: cardJson.endsWith('\n'),
  returnedHash,
  sha256OfSavedBytes: computed,
  hashMatchesBytes: computed === returnedHash,
})
show('DIFFERS FROM DOCS (agent-card page example card)', {
  missingTopLevelKeys: DOC_EXAMPLE_KEYS.filter((k) => !(k in card)),
  extraTopLevelKeys: Object.keys(card).filter((k) => !DOC_EXAMPLE_KEYS.includes(k)),
  badgeExtensionUris: extensions,
  note: 'The docs say the card is both an ERC-8004 registration file and an A2A card. Missing keys above are why this card is not yet a valid ERC-8004 file.',
})
console.log(`\nNext: commit and push public/agent-card.json, then run 02-check-hosted.ts --wait`)
if (computed !== returnedHash) process.exit(1)
