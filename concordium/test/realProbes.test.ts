import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createLinkProbe, createRealProbes, guardedHead, isPublicAddress, type Fetcher, type HttpReply } from '../src/service/realProbes.ts'
import { validateDeliveryProof } from '../src/service/validate.ts'

const NOW = (): Date => new Date('2026-11-11T12:00:00Z')

interface Call { address: string; hostname: string; path: string; method: string }
/** A fake network: names map to addresses, and each request gets the next scripted reply (or error). */
function fakeIo(dns: Record<string, string[]>, script: (HttpReply | Error)[]): { io: Fetcher; calls: Call[] } {
  const calls: Call[] = []
  const queue = [...script]
  return {
    calls,
    io: {
      resolve: (hostname) => {
        const found = dns[hostname]
        if (found === undefined) return Promise.reject(Object.assign(new Error('not found'), { code: 'ENOTFOUND' }))
        return Promise.resolve(found)
      },
      request: (args) => {
        calls.push({ address: args.address, hostname: args.hostname, path: args.path, method: args.method })
        const next = queue.shift() ?? { status: 200 }
        return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
      },
    },
  }
}
const PUBLIC = ['93.184.216.34']

void describe('which addresses may be contacted', () => {
  for (const ok of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.15.255.255', '172.32.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8']) {
    void it(`allows the public address ${ok}`, () => assert.equal(isPublicAddress(ok), true))
  }
  for (const bad of [
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '240.0.0.1',
    '::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', '::ffff:7f00:1', '64:ff9b::7f00:1', '2001:db8::1',
    'not-an-ip', '',
  ]) {
    void it(`refuses ${JSON.stringify(bad)}`, () => assert.equal(isPublicAddress(bad), false))
  }
})

void describe('the guarded request', () => {
  void it('connects to the address it checked, not to the name', async () => {
    const { io, calls } = fakeIo({ 'example.com': PUBLIC }, [{ status: 200 }])
    assert.deepEqual(await guardedHead('https://example.com/a?b=1', io), { kind: 'reply', status: 200 })
    assert.deepEqual(calls, [{ address: '93.184.216.34', hostname: 'example.com', path: '/a?b=1', method: 'HEAD' }])
  })

  for (const [label, url] of [
    ['plain http', 'http://example.com/'],
    ['another port', 'https://example.com:8443/'],
    ['credentials', 'https://user:pass@example.com/'],
    ['an IPv4 address', 'https://127.0.0.1/'],
    ['the cloud metadata address', 'https://169.254.169.254/latest/meta-data'],
    ['an IPv6 address', 'https://[::1]/'],
    ['something that is not an address', 'not a url'],
  ] as const) {
    void it(`blocks ${label} without making any request`, async () => {
      const { io, calls } = fakeIo({ 'example.com': PUBLIC }, [])
      assert.equal((await guardedHead(url, io)).kind, 'blocked')
      assert.equal(calls.length, 0)
    })
  }

  void it('blocks a public-looking name that resolves to an internal address', async () => {
    const { io, calls } = fakeIo({ 'localtest.me': ['127.0.0.1'] }, [])
    assert.equal((await guardedHead('https://localtest.me/', io)).kind, 'blocked')
    assert.equal(calls.length, 0)
  })

  void it('blocks a name with even one internal address among public ones', async () => {
    const { io, calls } = fakeIo({ 'mixed.example': ['93.184.216.34', '10.0.0.5'] }, [])
    assert.equal((await guardedHead('https://mixed.example/', io)).kind, 'blocked')
    assert.equal(calls.length, 0)
  })

  void it('blocks a redirect into the internal network, after the first request only', async () => {
    const { io, calls } = fakeIo({ 'example.com': PUBLIC, 'internal.example': ['10.0.0.5'] }, [{ status: 302, location: 'https://internal.example/admin' }])
    assert.equal((await guardedHead('https://example.com/', io)).kind, 'blocked')
    assert.equal(calls.length, 1)
  })

  void it('blocks a redirect down to plain http', async () => {
    const { io } = fakeIo({ 'example.com': PUBLIC }, [{ status: 301, location: 'http://example.com/' }])
    assert.equal((await guardedHead('https://example.com/', io)).kind, 'blocked')
  })

  void it('follows a relative redirect and checks it again', async () => {
    const { io, calls } = fakeIo({ 'example.com': PUBLIC }, [{ status: 301, location: '/moved' }, { status: 200 }])
    assert.deepEqual(await guardedHead('https://example.com/old', io), { kind: 'reply', status: 200 })
    assert.deepEqual(calls.map((c) => c.path), ['/old', '/moved'])
  })

  void it('gives up after too many redirects', async () => {
    const { io, calls } = fakeIo({ 'example.com': PUBLIC }, Array.from({ length: 10 }, () => ({ status: 302, location: '/again' })))
    assert.deepEqual(await guardedHead('https://example.com/', io, { maxRedirects: 3 }), { kind: 'failed', why: 'too_many_redirects' })
    assert.equal(calls.length, 4)
  })

  void it('falls back from HEAD to a one-byte GET when HEAD is not allowed', async () => {
    const { io, calls } = fakeIo({ 'example.com': PUBLIC }, [{ status: 405 }, { status: 206 }])
    assert.deepEqual(await guardedHead('https://example.com/', io), { kind: 'reply', status: 206 })
    assert.deepEqual(calls.map((c) => c.method), ['HEAD', 'GET'])
  })

  void it('reports timeouts, unknown names and other network errors distinctly', async () => {
    const timeout = Object.assign(new Error('x'), { code: 'ETIMEDOUT' })
    assert.deepEqual(await guardedHead('https://example.com/', fakeIo({ 'example.com': PUBLIC }, [timeout]).io), { kind: 'failed', why: 'timeout' })
    assert.deepEqual(await guardedHead('https://nope.example/', fakeIo({}, []).io), { kind: 'failed', why: 'dns_not_found' })
    assert.deepEqual(await guardedHead('https://example.com/', fakeIo({ 'example.com': PUBLIC }, [new Error('reset')]).io), { kind: 'failed', why: 'network' })
  })
})

const DNS = { 'example.com': PUBLIC, 'ipfs.io': ['209.94.90.1'], 'dweb.link': ['209.94.90.2'] }

void describe('what the link check reports', () => {
  const cases: [string, HttpReply | Error, string][] = [
    ['200', { status: 200 }, 'reachable'],
    ['206', { status: 206 }, 'reachable'],
    ['404', { status: 404 }, 'unreachable'],
    ['410', { status: 410 }, 'unreachable'],
    ['403', { status: 403 }, 'unreachable'],
    ['429', { status: 429 }, 'unavailable'],
    ['503', { status: 503 }, 'unavailable'],
    ['a timeout', Object.assign(new Error('t'), { code: 'ETIMEDOUT' }), 'unavailable'],
    ['a network error', new Error('reset'), 'unavailable'],
  ]
  for (const [label, reply, expected] of cases) {
    void it(`${label} is ${expected}`, async () => {
      const probe = createLinkProbe(fakeIo(DNS, [reply]).io)
      assert.equal((await probe.probeUrl('https://example.com/p')).status, expected)
    })
  }

  void it('an unknown name and a blocked target are both unreachable, and are not marked simulated', async () => {
    const probe = createLinkProbe(fakeIo({ 'localtest.me': ['127.0.0.1'] }, []).io)
    assert.equal((await probe.probeUrl('https://nope.example/')).status, 'unreachable')
    assert.equal((await probe.probeUrl('https://localtest.me/')).status, 'unreachable')
    assert.equal(probe.simulated, false)
  })
})

void describe('IPFS retrieval through public gateways', () => {
  const CID = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'

  void it('is retrievable when the first gateway serves it', async () => {
    const { io, calls } = fakeIo(DNS, [{ status: 200 }])
    assert.deepEqual(await createLinkProbe(io).probeCid(CID), { status: 'retrievable' })
    assert.equal(calls[0]?.path, `/ipfs/${CID}`)
  })

  void it('tries the next gateway when the first says not found', async () => {
    const { io, calls } = fakeIo(DNS, [{ status: 404 }, { status: 200 }])
    assert.deepEqual(await createLinkProbe(io).probeCid(CID), { status: 'retrievable' })
    assert.deepEqual(calls.map((c) => c.hostname), ['ipfs.io', 'dweb.link'])
  })

  void it('is not found only when every gateway says so', async () => {
    assert.deepEqual(await createLinkProbe(fakeIo(DNS, [{ status: 404 }, { status: 404 }]).io).probeCid(CID), { status: 'not_found' })
  })

  void it('is unavailable (try later) if any gateway had a temporary problem and none served it', async () => {
    assert.deepEqual(await createLinkProbe(fakeIo(DNS, [{ status: 504 }, { status: 404 }]).io).probeCid(CID), { status: 'unavailable' })
  })

  void it('never builds a request from an unsafe identifier', async () => {
    const { io, calls } = fakeIo(DNS, [])
    assert.deepEqual(await createLinkProbe(io).probeCid('../../etc/passwd'), { status: 'not_found' })
    assert.equal(calls.length, 0)
  })
})

void describe('inside the validator', () => {
  const proof = (type: string, value: string): string => JSON.stringify({ type, value, carrier: '', note: '' })

  void it('a reachable link passes and is NOT marked simulated', async () => {
    const probes = createRealProbes(fakeIo(DNS, [{ status: 200 }]).io)
    const v = await validateDeliveryProof({ proof: proof('url', 'https://example.com/proof') }, probes, NOW)
    assert.equal(v.verdict, 'pass')
    assert.equal(v.simulated, false)
    assert.doesNotMatch(v.reason, /simulated/i)
  })

  void it('a missing page fails, definitively', async () => {
    const probes = createRealProbes(fakeIo(DNS, [{ status: 404 }]).io)
    const v = await validateDeliveryProof({ proof: proof('url', 'https://example.com/gone') }, probes, NOW)
    assert.equal(v.verdict, 'fail')
    assert.equal(v.retryable, false)
  })

  void it('a server error is inconclusive, so it is retryable and will not be charged', async () => {
    const probes = createRealProbes(fakeIo(DNS, [{ status: 503 }]).io)
    const v = await validateDeliveryProof({ proof: proof('url', 'https://example.com/slow') }, probes, NOW)
    assert.equal(v.verdict, 'fail')
    assert.equal(v.retryable, true)
  })

  void it('a link to an internal address fails and no request is made', async () => {
    const { io, calls } = fakeIo({ 'localtest.me': ['127.0.0.1'] }, [])
    const v = await validateDeliveryProof({ proof: proof('url', 'https://localtest.me/admin') }, createRealProbes(io), NOW)
    assert.equal(v.verdict, 'fail')
    assert.equal(calls.length, 0)
  })

  void it('tracking numbers are still simulated, and say so', async () => {
    const v = await validateDeliveryProof({ proof: proof('tracking', '1Z999AA10123456784').replace('"carrier":""', '"carrier":"UPS"') }, createRealProbes(fakeIo(DNS, []).io), NOW)
    assert.equal(v.verdict, 'pass')
    assert.equal(v.simulated, true)
  })
})
