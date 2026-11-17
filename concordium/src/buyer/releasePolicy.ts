/**
 * What kind of evidence may release funds. Decided by the BUYER from the names of the checks that
 * passed, never from how the validator labels its own evidence.
 *
 *   carrier_status (real)       proves a parcel was delivered      -> may release
 *   carrier_status (simulated)  a stub: only meaningful in a demo   -> releases in demo mode only
 *   link_reachable, content_retrievable  prove a page or a file EXISTS. A worker can point at any live
 *                               page or any pinned file, so this is availability, not delivery
 *                                                                   -> does not release unless the
 *                                                                      operator explicitly accepts it
 *   format                      proves nothing about the world       -> does not release
 */
export interface GateOptions {
  demoMode: boolean
  acceptAvailabilityEvidence: boolean
}

export type ReleaseGate =
  | { release: true }
  | { release: false; code: 'SIMULATED_EVIDENCE' | 'AVAILABILITY_ONLY'; reason: string }

interface PassedCheck {
  name: string
  simulated: boolean
}

function passedChecks(verdict: { checks?: unknown }): PassedCheck[] {
  if (!Array.isArray(verdict.checks)) return []
  return (verdict.checks as ({ name?: unknown; ok?: unknown; simulated?: unknown } | null)[])
    .filter((c): c is { name?: unknown; ok?: unknown; simulated?: unknown } => typeof c === 'object' && c !== null)
    .filter((c) => c.ok === true && typeof c.name === 'string')
    .map((c) => ({ name: c.name as string, simulated: c.simulated === true }))
}

export function releaseGate(verdict: { checks?: unknown }, options: GateOptions): ReleaseGate {
  const passed = passedChecks(verdict)
  const carrier = passed.filter((c) => c.name === 'carrier_status')

  if (carrier.some((c) => !c.simulated)) return { release: true }

  if (!options.demoMode && passed.some((c) => c.simulated)) {
    return { release: false, code: 'SIMULATED_EVIDENCE', reason: 'The pass rests on simulated lookups, which cannot release funds outside demo mode.' }
  }
  if (carrier.length > 0) return { release: true } // a simulated carrier pass, in demo mode only

  if (!options.acceptAvailabilityEvidence) {
    return {
      release: false,
      code: 'AVAILABILITY_ONLY',
      reason: 'The pass shows that a page or file exists, not that anything was delivered, so it does not release funds. The order stays with the timer or a human.',
    }
  }
  return { release: true }
}
