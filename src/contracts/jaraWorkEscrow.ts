/**
 * JaraWorkEscrow contract config
 * Deployed on Arc Testnet at 0xf34d22b12d168925d4f0ffde2e3fe769e7f15440 (v3 — owner=user wallet, platform=agent wallet)
 * Previous: 0xd454036b54c5be123e2e3331fd9363df14400af5 (v2), 0x74eb073bee50937a762cdd3836ca1b3b12919c5d (v1)
 */
import artifact from '../../contracts/out/JaraWorkEscrow.sol/JaraWorkEscrow.json'

export const JARA_WORK_ESCROW = {
  address: '0xf34d22b12d168925d4f0ffde2e3fe769e7f15440' as const,
  abi: artifact.abi,
} as const

export type OrderStatus = 0 | 1 | 2 | 3 | 4 | 5
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  0: 'Open',
  1: 'Claimed',
  2: 'Delivered',
  3: 'Completed',
  4: 'Refunded',
  5: 'Disputed',
}

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  0: 'text-blue-600 bg-blue-50',
  1: 'text-amber-700 bg-amber-50',
  2: 'text-purple-700 bg-purple-50',
  3: 'text-green-700 bg-green-50',
  4: 'text-gray-600 bg-gray-100',
  5: 'text-red-700 bg-red-50',
}

export const MARKETPLACE_LABELS: Record<string, string> = {
  jaramarket: 'Jaramarket',
  amazon: 'Amazon',
  ebay: 'eBay',
  jumia: 'Jumia',
  manual: 'Manual',
}

export const MARKETPLACE_COLORS: Record<string, string> = {
  jaramarket: 'bg-orange-100 text-orange-800',
  amazon: 'bg-yellow-100 text-yellow-800',
  ebay: 'bg-red-100 text-red-800',
  jumia: 'bg-green-100 text-green-800',
  manual: 'bg-gray-100 text-gray-700',
}

export interface Order {
  orderId: string
  title: string
  description: string
  sourceMarketplace: string
  amount: bigint
  buyer: string
  worker: string
  status: OrderStatus
  createdAt: bigint
  claimedAt: bigint
  completedAt: bigint
  deliveryProof: string
}
