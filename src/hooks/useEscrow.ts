/**
 * Wagmi hooks wrapping JaraWorkEscrow contract reads/writes
 */
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount, useSwitchChain } from 'wagmi'
import { useState, useEffect } from 'react'
import { erc20Abi, parseUnits } from 'viem'
import { arcTestnet } from 'viem/chains'
import { JARA_WORK_ESCROW, type Order } from '../contracts/jaraWorkEscrow'
import { getUsdc } from '../onchain-facts'

const CHAIN_ID = arcTestnet.id
const usdcFact = getUsdc(CHAIN_ID)
export const USDC_ADDRESS = usdcFact?.address as `0x${string}`

// ─── Read hooks ────────────────────────────────────────────────────────────────

export function useOrderCount() {
  return useReadContract({
    ...JARA_WORK_ESCROW,
    functionName: 'getOrderCount',
    chainId: CHAIN_ID,
  })
}

export function useOpenOrderKeys() {
  return useReadContract({
    ...JARA_WORK_ESCROW,
    functionName: 'getOpenOrders',
    chainId: CHAIN_ID,
  })
}

const PAGE_SIZE = 20

export function useOpenOrdersPaginated(offset: number) {
  return useReadContract({
    ...JARA_WORK_ESCROW,
    functionName: 'getOpenOrdersPaginated',
    args: [BigInt(offset), BigInt(PAGE_SIZE)],
    chainId: CHAIN_ID,
  })
}

export { PAGE_SIZE as ORDERS_PAGE_SIZE }

export function useOrderKeys(offset: number, limit: number) {
  return useReadContract({
    ...JARA_WORK_ESCROW,
    functionName: 'getOrderKeys',
    args: [BigInt(offset), BigInt(limit)],
    chainId: CHAIN_ID,
  })
}

export function useOrder(key: `0x${string}` | undefined) {
  return useReadContract({
    ...JARA_WORK_ESCROW,
    functionName: 'getOrder',
    args: key ? [key] : undefined,
    query: { enabled: !!key },
    chainId: CHAIN_ID,
  })
}

export function useWorkerOrders(worker: `0x${string}` | undefined) {
  return useReadContract({
    ...JARA_WORK_ESCROW,
    functionName: 'getOrdersByWorker',
    args: worker ? [worker] : undefined,
    query: { enabled: !!worker },
    chainId: CHAIN_ID,
  })
}

export function useBuyerOrders(buyer: `0x${string}` | undefined) {
  return useReadContract({
    ...JARA_WORK_ESCROW,
    functionName: 'getOrdersByBuyer',
    args: buyer ? [buyer] : undefined,
    query: { enabled: !!buyer },
    chainId: CHAIN_ID,
  })
}

export function useUsdcAllowance(owner: `0x${string}` | undefined) {
  return useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: owner ? [owner, JARA_WORK_ESCROW.address] : undefined,
    query: { enabled: !!owner },
    chainId: CHAIN_ID,
  })
}

export function useUsdcBalance(address: `0x${string}` | undefined) {
  return useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
    chainId: CHAIN_ID,
  })
}

// ─── Write hooks ───────────────────────────────────────────────────────────────

export function useApproveUsdc() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const approve = (amount: bigint) => {
    writeContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'approve',
      args: [JARA_WORK_ESCROW.address, amount],
    })
  }

  return { approve, hash, isPending, isConfirming, isSuccess, error, reset }
}

export function useCreateOrder() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  const { chainId } = useAccount()
  const { switchChain } = useSwitchChain()

  const create = (
    orderId: string,
    title: string,
    description: string,
    sourceMarketplace: string,
    usdcAmount: string,
  ) => {
    if (chainId !== CHAIN_ID) {
      switchChain({ chainId: CHAIN_ID })
      return
    }
    const parsed = parseUnits(usdcAmount, 6)
    writeContract({
      ...JARA_WORK_ESCROW,
      functionName: 'createOrder',
      args: [orderId, title, description, sourceMarketplace, parsed],
    })
  }

  return { create, hash, isPending, isConfirming, isSuccess, error, reset }
}

export function useClaimOrder() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  const { chainId } = useAccount()
  const { switchChain } = useSwitchChain()

  const claim = (key: `0x${string}`) => {
    if (chainId !== CHAIN_ID) {
      switchChain({ chainId: CHAIN_ID })
      return
    }
    writeContract({ ...JARA_WORK_ESCROW, functionName: 'claimOrder', args: [key] })
  }

  return { claim, hash, isPending, isConfirming, isSuccess, error, reset }
}

export function useSubmitDelivery() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  const { chainId } = useAccount()
  const { switchChain } = useSwitchChain()

  const submit = (key: `0x${string}`, proof: string) => {
    if (chainId !== CHAIN_ID) {
      switchChain({ chainId: CHAIN_ID })
      return
    }
    writeContract({ ...JARA_WORK_ESCROW, functionName: 'submitDelivery', args: [key, proof] })
  }

  return { submit, hash, isPending, isConfirming, isSuccess, error, reset }
}

export function useConfirmDelivery() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  const { chainId } = useAccount()
  const { switchChain } = useSwitchChain()

  const confirm = (key: `0x${string}`) => {
    if (chainId !== CHAIN_ID) {
      switchChain({ chainId: CHAIN_ID })
      return
    }
    writeContract({ ...JARA_WORK_ESCROW, functionName: 'confirmDelivery', args: [key] })
  }

  return { confirm, hash, isPending, isConfirming, isSuccess, error, reset }
}

export function useRefundOrder() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  const { chainId } = useAccount()
  const { switchChain } = useSwitchChain()

  const refund = (key: `0x${string}`) => {
    if (chainId !== CHAIN_ID) {
      switchChain({ chainId: CHAIN_ID })
      return
    }
    writeContract({ ...JARA_WORK_ESCROW, functionName: 'refundOrder', args: [key] })
  }

  return { refund, hash, isPending, isConfirming, isSuccess, error, reset }
}

export function useSetPlatform() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  const { chainId } = useAccount()
  const { switchChain } = useSwitchChain()

  const setPlatform = (newPlatform: `0x${string}`) => {
    if (chainId !== CHAIN_ID) {
      switchChain({ chainId: CHAIN_ID })
      return
    }
    writeContract({ ...JARA_WORK_ESCROW, functionName: 'setPlatform', args: [newPlatform] })
  }

  return { setPlatform, hash, isPending, isConfirming, isSuccess, error, reset }
}

export function useDisputedOrderKeys() {
  return useReadContract({
    ...JARA_WORK_ESCROW,
    functionName: 'getDisputedOrders',
    chainId: CHAIN_ID,
  })
}

export function useResolveDispute() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  const { chainId } = useAccount()
  const { switchChain } = useSwitchChain()

  // payWorker=true → USDC goes to worker; payWorker=false → refund to buyer
  const resolve = (key: `0x${string}`, payWorker: boolean) => {
    if (chainId !== CHAIN_ID) {
      switchChain({ chainId: CHAIN_ID })
      return
    }
    writeContract({ ...JARA_WORK_ESCROW, functionName: 'resolveDispute', args: [key, payWorker] })
  }

  return { resolve, hash, isPending, isConfirming, isSuccess, error, reset }
}

export function useContractOwner() {
  return useReadContract({
    ...JARA_WORK_ESCROW,
    functionName: 'owner',
    chainId: CHAIN_ID,
  })
}

export function useContractPlatform() {
  return useReadContract({
    ...JARA_WORK_ESCROW,
    functionName: 'platform',
    chainId: CHAIN_ID,
  })
}

export function useFeeBps() {
  return useReadContract({
    ...JARA_WORK_ESCROW,
    functionName: 'feeBasisPoints',
    chainId: CHAIN_ID,
  })
}

export function useFeeRecipient() {
  return useReadContract({
    ...JARA_WORK_ESCROW,
    functionName: 'platformFeeRecipient',
    chainId: CHAIN_ID,
  })
}

export function useSetFeeBps() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  const { chainId } = useAccount()
  const { switchChain } = useSwitchChain()

  const setFeeBps = (bps: number) => {
    if (chainId !== CHAIN_ID) { switchChain({ chainId: CHAIN_ID }); return }
    writeContract({ ...JARA_WORK_ESCROW, functionName: 'setFeeBasisPoints', args: [BigInt(bps)] })
  }

  return { setFeeBps, hash, isPending, isConfirming, isSuccess, error, reset }
}

export function useSetFeeRecipient() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  const { chainId } = useAccount()
  const { switchChain } = useSwitchChain()

  const setFeeRecipient = (recipient: `0x${string}`) => {
    if (chainId !== CHAIN_ID) { switchChain({ chainId: CHAIN_ID }); return }
    writeContract({ ...JARA_WORK_ESCROW, functionName: 'setPlatformFeeRecipient', args: [recipient] })
  }

  return { setFeeRecipient, hash, isPending, isConfirming, isSuccess, error, reset }
}

export function useDisputeOrder() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  const { chainId } = useAccount()
  const { switchChain } = useSwitchChain()

  const dispute = (key: `0x${string}`) => {
    if (chainId !== CHAIN_ID) {
      switchChain({ chainId: CHAIN_ID })
      return
    }
    writeContract({ ...JARA_WORK_ESCROW, functionName: 'disputeOrder', args: [key] })
  }

  return { dispute, hash, isPending, isConfirming, isSuccess, error, reset }
}

// ─── Worker reputation (derived purely from on-chain order history) ────────────

export interface WorkerReputation {
  address: string
  totalOrders: number        // all orders ever claimed
  completed: number          // status === Completed (3)
  disputed: number           // status === Disputed (5)
  refunded: number           // status === Refunded (4) while worker was assigned
  inProgress: number         // Claimed (1) or Delivered (2)
  completionRate: number     // completed / (completed + refunded + disputed) * 100
  totalEarned: bigint        // sum of amounts for Completed orders (before fee)
  score: number              // 0–100 composite score
  level: 'Newcomer' | 'Reliable' | 'Trusted' | 'Expert' | 'Elite'
}

export function useWorkerReputation(worker: `0x${string}` | undefined): {
  reputation: WorkerReputation | null
  isLoading: boolean
} {
  // Single wagmi read for all worker order keys
  const { data: reputationData, isLoading, refetch: _refetch } = useReadContract({
    ...JARA_WORK_ESCROW,
    functionName: 'getOrdersByWorker',
    args: worker ? [worker] : undefined,
    query: { enabled: !!worker },
    chainId: CHAIN_ID,
  })

  // Build reputation from individual order reads — we do this client-side
  // by reading each order key. Since we can't call hooks in a loop, we use
  // the raw key list and compute asynchronously via a separate hook.
  const [reputation, setReputation] = useState<WorkerReputation | null>(null)
  const [computing, setComputing] = useState(false)

  const { chainId: connChainId } = useAccount()

  useEffect(() => {
    if (!worker || !reputationData) { setReputation(null); return }
    const orderKeys = reputationData as `0x${string}`[]
    if (orderKeys.length === 0) {
      setReputation({
        address: worker, totalOrders: 0, completed: 0, disputed: 0, refunded: 0,
        inProgress: 0, completionRate: 0, totalEarned: 0n, score: 0, level: 'Newcomer',
      })
      return
    }

    setComputing(true)
    // Fetch each order via wagmi's public client read
    // We use dynamic viem publicClient reads here to avoid hook-in-loop
    async function compute() {
      try {
        const { createPublicClient, http } = await import('viem')
        const { arcTestnet: arcChain } = await import('viem/chains')
        const client = createPublicClient({ chain: arcChain, transport: http() })

        const results = await Promise.allSettled(
          orderKeys.map(key =>
            client.readContract({ ...JARA_WORK_ESCROW, functionName: 'getOrder', args: [key] })
          )
        )

        let completed = 0, disputed = 0, refunded = 0, inProgress = 0
        let totalEarned = 0n

        for (const r of results) {
          if (r.status !== 'fulfilled') continue
          const o = parseOrderStruct(r.value)
          if (o.status === 3) { completed++; totalEarned += o.amount }
          else if (o.status === 5) disputed++
          else if (o.status === 4) refunded++
          else if (o.status === 1 || o.status === 2) inProgress++
        }

        const judged = completed + disputed + refunded
        const completionRate = judged > 0 ? Math.round((completed / judged) * 100) : 0

        // Score: completion rate weighted 60%, volume bonus 30%, dispute penalty 10%
        const volumeBonus  = Math.min(orderKeys.length / 20, 1) * 30   // max 30 at 20+ orders
        const disputePenalty = Math.min(disputed * 10, 20)              // -10 per dispute, max -20
        const score = Math.max(0, Math.round(completionRate * 0.6 + volumeBonus - disputePenalty))

        const level: WorkerReputation['level'] =
          score >= 90 ? 'Elite' :
          score >= 75 ? 'Expert' :
          score >= 55 ? 'Trusted' :
          score >= 30 ? 'Reliable' : 'Newcomer'

        setReputation({
          address: worker!, totalOrders: orderKeys.length, completed, disputed, refunded,
          inProgress, completionRate, totalEarned, score, level,
        })
      } catch {
        setReputation(null)
      } finally {
        setComputing(false)
      }
    }

    void compute()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worker, reputationData, connChainId])

  return { reputation, isLoading: isLoading || computing }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function parseOrderStruct(raw: unknown): Order {
  const r = raw as readonly [string, string, string, string, bigint, string, string, number, bigint, bigint, bigint, string]
  return {
    orderId: r[0],
    title: r[1],
    description: r[2],
    sourceMarketplace: r[3],
    amount: r[4],
    buyer: r[5],
    worker: r[6],
    status: r[7] as Order['status'],
    createdAt: r[8],
    claimedAt: r[9],
    completedAt: r[10],
    deliveryProof: r[11],
  }
}
