/**
 * The MCP server: one tool, validate_delivery_proof.
 * Built with the official SDK (@modelcontextprotocol/sdk 1.x): McpServer + registerTool.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as z from 'zod/v4'
import { createStubProbes } from './probes.ts'
import type { Probes } from './probes.ts'
import { VALIDATOR_INFO } from './types.ts'
import { validateDeliveryProof } from './validate.ts'

const hex64 = z.string().regex(/^[0-9a-f]{64}$/)

const checkShape = z.object({
  name: z.enum(['format', 'carrier_status', 'link_reachable', 'content_retrievable']),
  ok: z.boolean(),
  simulated: z.boolean(),
  observed: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
})

/** The structured result, as the MCP outputSchema. Mirrors ProofVerdict. */
export const VERDICT_SHAPE = {
  schemaVersion: z.literal('1'),
  verdict: z.enum(['pass', 'fail']),
  kind: z.enum(['tracking', 'url', 'ipfs', 'text', 'unknown']),
  code: z.enum(['OK', 'BAD_INPUT', 'BAD_ENVELOPE', 'INVALID_FORMAT', 'CARRIER_MISMATCH', 'NOT_CONFIRMED', 'UNREACHABLE', 'NOT_VERIFIABLE']),
  reason: z.string(),
  retryable: z.boolean(),
  simulated: z.boolean(),
  checks: z.array(checkShape),
  evidenceHash: hex64,
  proofSha256: hex64,
  orderRef: z.string().optional(),
  validatedAt: z.string(),
  validator: z.object({ name: z.string(), version: z.string() }),
}

const DESCRIPTION =
  'Checks one delivery proof for a JaraWork escrow order and returns verdict (pass or fail), a short reason, ' +
  'and evidenceHash, a SHA-256 over the evidence that was examined. "proof" is the exact string stored in the ' +
  'order: a JSON object {"type":"tracking|url|ipfs|text","value":"...","carrier":"..."}. Free text never passes. ' +
  'IMPORTANT: in this testnet build the carrier, link and IPFS lookups are SIMULATED by stubs. When "simulated" ' +
  'is true, a pass is not real-world evidence of delivery.'

/** The tool handler's shape, so paid mode can wrap it without changing the free behaviour. */
export type ToolHandler = (
  args: { proof: string; orderRef?: string | undefined },
  extra: unknown,
) => Promise<{
  content: { type: 'text'; text: string }[]
  structuredContent: Record<string, unknown>
  isError?: boolean
  _meta?: Record<string, unknown>
}>
export type ToolWrap = (handler: ToolHandler) => ToolHandler

export function createValidatorMcpServer(probes: Probes = createStubProbes(), wrap: ToolWrap = (handler) => handler): McpServer {
  const server = new McpServer({ name: VALIDATOR_INFO.name, version: VALIDATOR_INFO.version })

  server.registerTool(
    'validate_delivery_proof',
    {
      title: 'Validate delivery proof',
      description: DESCRIPTION,
      inputSchema: {
        proof: z.string().describe('The exact deliveryProof string from the order (a JSON envelope), at most 1024 characters.'),
        orderRef: z.string().optional().describe('Optional opaque reference for your own records, 1 to 64 characters of A-Z a-z 0-9 . _ : -'),
      },
      outputSchema: VERDICT_SHAPE,
      annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
    },
    wrap(async (args) => {
      const result = await validateDeliveryProof(args, probes)
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: { ...result } }
    }),
  )

  return server
}
