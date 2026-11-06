import type { Server } from 'node:http'
import type { ToolWrap } from './src/service/mcp.ts'
import type { Probes } from './src/service/probes.ts'

/** Builds the HTTP server without starting it. See server.mjs. */
export function createAppServer(options?: {
  probes?: Probes
  wrap?: ToolWrap
  paymentStatus?: () => Record<string, unknown>
}): Server
