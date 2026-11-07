/**
 * A stub order store for the demo. It holds orders in memory and moves nothing: no Arc, no Circle,
 * no USDC. It refuses to be created at all if any mainnet configuration of the live JaraWork app
 * is present in the environment, so it can never be pointed at the real escrow by accident.
 */
export type OrderStatus = 'Delivered' | 'Released' | 'Flagged' | 'Deferred'

export interface StubOrder {
  key: string
  orderRef: string
  /** Display only. Nothing is ever transferred. */
  amountDisplay: string
  /** The exact deliveryProof string, as stored on the order. */
  proof: string
  status: OrderStatus
  note?: string
}

const FORBIDDEN_ENV = [
  'CIRCLE_MAINNET_API_KEY',
  'CIRCLE_MAINNET_ENTITY_SECRET',
  'VITE_MAINNET_ESCROW_CONTRACT_ADDRESS',
  'VITE_MAINNET_AGENT_WALLET_ID',
  'VITE_MAINNET_AGENT_WALLET_ADDRESS',
]

export function assertNoMainnetEnv(env: Record<string, string | undefined> = process.env): void {
  const present = FORBIDDEN_ENV.filter((name) => (env[name] ?? '') !== '')
  if (present.length > 0) {
    throw new Error(`Refusing to start the stub order store: live mainnet settings are present (${present.join(', ')}). Use a separate environment.`)
  }
}

export class StubOrderStore {
  private readonly orders = new Map<string, StubOrder>()

  constructor(seed: StubOrder[], env: Record<string, string | undefined> = process.env) {
    assertNoMainnetEnv(env)
    for (const order of seed) this.orders.set(order.key, { ...order })
  }

  get(key: string): StubOrder | undefined {
    return this.orders.get(key)
  }

  delivered(): StubOrder[] {
    return [...this.orders.values()].filter((order) => order.status === 'Delivered')
  }

  all(): StubOrder[] {
    return [...this.orders.values()]
  }

  private move(key: string, status: OrderStatus, note: string): void {
    const order = this.orders.get(key)
    if (!order) throw new Error(`No such order: ${key}`)
    if (order.status !== 'Delivered') throw new Error(`Order ${key} is already ${order.status}`)
    order.status = status
    order.note = note
  }

  release(key: string, note: string): void {
    this.move(key, 'Released', note)
  }

  flag(key: string, note: string): void {
    this.move(key, 'Flagged', note)
  }

  defer(key: string, note: string): void {
    this.move(key, 'Deferred', note)
  }
}
