/**
 * External lookups sit behind these interfaces. This file holds the STUBS: explicit fixtures that never
 * touch the network, where anything not in a fixture table is "not found". The real, guarded link and IPFS
 * checks live in realProbes.ts and are the default for the service; the carrier lookup is still a stub here
 * until real carrier credentials exist. Results derived from a stub are labelled `simulated` in the response.
 */

export interface CarrierLookupResult {
  status: 'delivered' | 'in_transit' | 'not_found' | 'unavailable'
  /** Date the carrier reports delivery, when known. Part of the hashed evidence. */
  deliveredOn?: string
}

export interface CarrierLookup {
  readonly simulated: boolean
  lookup(trackingNumber: string, declaredCarrier: string): Promise<CarrierLookupResult>
}

export interface LinkProbeResult {
  status: 'reachable' | 'unreachable' | 'unavailable'
  httpStatus?: number
}

export interface CidProbeResult {
  status: 'retrievable' | 'not_found' | 'unavailable'
}

export interface LinkProbe {
  readonly simulated: boolean
  probeUrl(url: string): Promise<LinkProbeResult>
  probeCid(cid: string): Promise<CidProbeResult>
}

export interface Probes {
  carrier: CarrierLookup
  link: LinkProbe
}

/** Tracking numbers the stub "knows". Anything else is not_found. */
export const CARRIER_FIXTURES: Readonly<Record<string, CarrierLookupResult>> = {
  '1Z999AA10123456784': { status: 'delivered', deliveredOn: '2026-11-01' },
  RR123456785US: { status: 'delivered', deliveredOn: '2026-10-28' },
  '9400111899223197428490': { status: 'delivered', deliveredOn: '2026-11-02' },
  '123456789012': { status: 'in_transit' },
}

export const REACHABLE_HOSTS: readonly string[] = ['example.com', 'www.example.com', 'example.org', 'proof.jarawork.online']

export const RETRIEVABLE_CIDS: readonly string[] = [
  'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
  'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
]

export function createStubCarrierLookup(fixtures: Readonly<Record<string, CarrierLookupResult>> = CARRIER_FIXTURES): CarrierLookup {
  return {
    simulated: true,
    lookup: (trackingNumber) => Promise.resolve(fixtures[trackingNumber] ?? { status: 'not_found' }),
  }
}

export function createStubLinkProbe(
  reachableHosts: readonly string[] = REACHABLE_HOSTS,
  retrievableCids: readonly string[] = RETRIEVABLE_CIDS,
): LinkProbe {
  return {
    simulated: true,
    probeUrl: (url) => {
      const host = new URL(url).hostname.toLowerCase()
      return Promise.resolve(reachableHosts.includes(host) ? { status: 'reachable', httpStatus: 200 } : { status: 'unreachable' })
    },
    probeCid: (cid) => Promise.resolve({ status: retrievableCids.includes(cid) ? 'retrievable' : 'not_found' }),
  }
}

export function createStubProbes(): Probes {
  return { carrier: createStubCarrierLookup(), link: createStubLinkProbe() }
}
