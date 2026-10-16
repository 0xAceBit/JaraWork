/**
 * useAnalytics — fetches all on-chain orders and computes platform stats
 * Reads retroactively from the deployed JaraWorkEscrow contract on Arc Mainnet.
 */
import { useState, useEffect, useCallback } from 'react'
import { arc } from 'viem/chains'
import { JARA_WORK_ESCROW_ABI } from '../contracts/jaraWorkEscrow'
import type { Order } from '../contracts/jaraWorkEscrow'
import { createPublicClient, http, fallback, formatUnits } from 'viem'

const CONTRACT = '0x52A34aD73fAe6Bd151F25F1BCDf13AA7781422d5' as const
const BATCH = 50 // keys to fetch per getOrderKeys call

const analyticsClient = createPublicClient({
  chain: arc,
  transport: fallback([
    http('https://rpc.mainnet.arc.io', { timeout: 15_000, retryCount: 1 }),
    http('https://rpc.quicknode.mainnet.arc.io', { timeout: 15_000, retryCount: 1 }),
    http('https://rpc.drpc.mainnet.arc.io', { timeout: 15_000, retryCount: 1 }),
    http('https://rpc.blockdaemon.mainnet.arc.io', { timeout: 15_000, retryCount: 1 }),
  ]),
})

export interface AnalyticsData {
  totalOrders: number
  openOrders: number
  claimedOrders: number
  deliveredOrders: number
  completedOrders: number
  refundedOrders: number
  disputedOrders: number
  completionRate: number      // % of all orders that completed
  refundRate: number
  disputeRate: number
  totalVolumeUsdc: number     // sum of all order amounts ever locked
  completedVolumeUsdc: number // sum of completed order amounts
  uniqueBuyers: number
  uniqueWorkers: number
  avgOrderValueUsdc: number
  avgTimeToClaimHours: number | null
  avgTimeToCompleteHours: number | null
  byMarketplace: Record<string, number>
  topWorkers: Array<{ address: string; completedCount: number; earnedUsdc: number }>
  ordersOverTime: Array<{ date: string; count: number }>
  loading: boolean
  error: string | null
  lastFetched: number | null
}

const EMPTY: AnalyticsData = {
  totalOrders: 0,
  openOrders: 0,
  claimedOrders: 0,
  deliveredOrders: 0,
  completedOrders: 0,
  refundedOrders: 0,
  disputedOrders: 0,
  completionRate: 0,
  refundRate: 0,
  disputeRate: 0,
  totalVolumeUsdc: 0,
  completedVolumeUsdc: 0,
  uniqueBuyers: 0,
  uniqueWorkers: 0,
  avgOrderValueUsdc: 0,
  avgTimeToClaimHours: null,
  avgTimeToCompleteHours: null,
  byMarketplace: {},
  topWorkers: [],
  ordersOverTime: [],
  loading: false,
  error: null,
  lastFetched: null,
}

async function fetchAllOrders(): Promise<Order[]> {
  // Step 1: total count — 1 RPC call
  const countRaw = await analyticsClient.readContract({
    address: CONTRACT,
    abi: JARA_WORK_ESCROW_ABI,
    functionName: 'getOrderCount',
  })
  const total = Number(countRaw)
  if (total === 0) return []

  // Step 2: fetch all key batches in parallel
  const offsets: number[] = []
  for (let offset = 0; offset < total; offset += BATCH) {
    offsets.push(offset)
  }
  const keyBatches = await Promise.all(
    offsets.map(offset =>
      analyticsClient.readContract({
        address: CONTRACT,
        abi: JARA_WORK_ESCROW_ABI,
        functionName: 'getOrderKeys',
        args: [BigInt(offset), BigInt(BATCH)],
      }) as Promise<`0x${string}`[]>
    )
  )
  const allKeys = keyBatches.flat()

  // Step 3: fetch all orders in parallel
  const orders = await Promise.all(
    allKeys.map(key =>
      analyticsClient.readContract({
        address: CONTRACT,
        abi: JARA_WORK_ESCROW_ABI,
        functionName: 'getOrder',
        args: [key],
      }) as Promise<Order>
    )
  )

  return orders
}


function computeStats(orders: Order[]): Omit<AnalyticsData, 'loading' | 'error' | 'lastFetched'> {
  const byStatus = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  const buyers = new Set<string>()
  const workers = new Set<string>()
  const byMarketplace: Record<string, number> = {}
  const workerStats: Record<string, { completedCount: number; earnedUsdc: number }> = {}
  const byDate: Record<string, number> = {}

  let totalVolume = 0n
  let completedVolume = 0n
  let totalClaimDelaySec = 0
  let claimDelayCount = 0
  let totalCompletionDelaySec = 0
  let completionDelayCount = 0

  for (const o of orders) {
    byStatus[o.status as 0|1|2|3|4|5]++

    buyers.add(o.buyer.toLowerCase())
    if (o.worker && o.worker !== '0x0000000000000000000000000000000000000000') {
      workers.add(o.worker.toLowerCase())
    }

    totalVolume += o.amount

    if (o.status === 3) { // Completed
      completedVolume += o.amount
      const workerAddr = o.worker.toLowerCase()
      if (!workerStats[workerAddr]) workerStats[workerAddr] = { completedCount: 0, earnedUsdc: 0 }
      workerStats[workerAddr].completedCount++
      workerStats[workerAddr].earnedUsdc += parseFloat(formatUnits(o.amount, 6))
    }

    // Marketplace breakdown
    const mkt = o.sourceMarketplace || 'manual'
    byMarketplace[mkt] = (byMarketplace[mkt] ?? 0) + 1

    // Time to claim
    if (o.claimedAt > 0n && o.createdAt > 0n) {
      totalClaimDelaySec += Number(o.claimedAt - o.createdAt)
      claimDelayCount++
    }

    // Time to complete
    if (o.completedAt > 0n && o.claimedAt > 0n) {
      totalCompletionDelaySec += Number(o.completedAt - o.claimedAt)
      completionDelayCount++
    }

    // Orders over time — bucket by day
    const day = new Date(Number(o.createdAt) * 1000).toISOString().slice(0, 10)
    byDate[day] = (byDate[day] ?? 0) + 1
  }

  const total = orders.length
  const topWorkers = Object.entries(workerStats)
    .map(([address, s]) => ({ address, ...s }))
    .sort((a, b) => b.completedCount - a.completedCount)
    .slice(0, 10)

  const ordersOverTime = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))

  const totalVolumeUsdc = parseFloat(formatUnits(totalVolume, 6))
  const completedVolumeUsdc = parseFloat(formatUnits(completedVolume, 6))

  return {
    totalOrders: total,
    openOrders: byStatus[0],
    claimedOrders: byStatus[1],
    deliveredOrders: byStatus[2],
    completedOrders: byStatus[3],
    refundedOrders: byStatus[4],
    disputedOrders: byStatus[5],
    completionRate: total > 0 ? Math.round((byStatus[3] / total) * 100) : 0,
    refundRate: total > 0 ? Math.round((byStatus[4] / total) * 100) : 0,
    disputeRate: total > 0 ? Math.round((byStatus[5] / total) * 100) : 0,
    totalVolumeUsdc,
    completedVolumeUsdc,
    uniqueBuyers: buyers.size,
    uniqueWorkers: workers.size,
    avgOrderValueUsdc: total > 0 ? Math.round((totalVolumeUsdc / total) * 100) / 100 : 0,
    avgTimeToClaimHours: claimDelayCount > 0
      ? Math.round((totalClaimDelaySec / claimDelayCount / 3600) * 10) / 10
      : null,
    avgTimeToCompleteHours: completionDelayCount > 0
      ? Math.round((totalCompletionDelaySec / completionDelayCount / 3600) * 10) / 10
      : null,
    byMarketplace,
    topWorkers,
    ordersOverTime,
  }
}

export function useAnalytics() {
  const [data, setData] = useState<AnalyticsData>({ ...EMPTY })

  const load = useCallback(async () => {
    setData(prev => ({ ...prev, loading: true, error: null }))
    try {
      const orders = await fetchAllOrders()
      const stats = computeStats(orders)
      setData({ ...stats, loading: false, error: null, lastFetched: Date.now() })
    } catch (e) {
      setData(prev => ({ ...prev, loading: false, error: (e as Error).message }))
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return { ...data, refresh: load }
}

