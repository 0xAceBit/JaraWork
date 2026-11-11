import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { describe, it } from 'node:test'
import { createAppServer } from '../server.mjs'

async function withServer<T>(run: (base: string) => Promise<T>): Promise<T> {
  const server = createAppServer({})
  await new Promise<void>((resolve) => server.listen(0, resolve))
  try {
    return await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}

void describe('share preview image and page tags', () => {
  void it('serves the link image as an SVG', async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/og-image.svg`)
      assert.equal(res.status, 200)
      assert.match(res.headers.get('content-type') ?? '', /image\/svg\+xml/)
      assert.match(await res.text(), /<svg /)
    })
  })

  void it('describes THIS service, not the main marketplace (no Arc or USDC claims)', async () => {
    await withServer(async (base) => {
      const svg = await (await fetch(`${base}/og-image.svg`)).text()
      assert.match(svg, /PROOF VALIDATOR/)
      assert.doesNotMatch(svg, /Arc Mainnet|USDC|ORDER-TO-EARNER/)
    })
  })

  void it('the page carries the favicon and absolute share-preview tags', async () => {
    await withServer(async (base) => {
      const html = await (await fetch(`${base}/`, { headers: { accept: 'text/html' } })).text()
      assert.match(html, /<link rel="icon"/)
      assert.match(html, /property="og:image" content="https:\/\/jarawork-agent\.onrender\.com\/og-image\.svg"/)
      assert.match(html, /name="twitter:card" content="summary_large_image"/)
      assert.match(html, /name="twitter:image" content="https:\/\/jarawork-agent\.onrender\.com\/og-image\.svg"/)
    })
  })
})

void describe('the try-a-proof form', () => {
  void it('is on the page, labelled as a free format preview, and writes results as text only', async () => {
    await withServer(async (base) => {
      const html = await (await fetch(`${base}/`, { headers: { accept: 'text/html' } })).text()
      assert.match(html, /id="p-go"/)
      assert.match(html, /free preview/i)
      assert.match(html, /format only/i)
      const script = html.slice(html.lastIndexOf('<script>'))
      assert.doesNotMatch(script, /innerHTML|document\.write|eval\(/, 'results must be written with textContent only')
    })
  })
})
