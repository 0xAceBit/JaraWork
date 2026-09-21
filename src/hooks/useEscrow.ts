/**
 * Wagmi hooks wrapping JaraWorkEscrow contract reads/writes
 */
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount, useSwitchChain } from 'wagmi'
import { erc20Abi } from 'viem'
import { arcTestnet } from 'viem/chains'
import { JARA_WORK_ESCROW, type Order } from '../contracts/jaraWorkEscrow'
import { getUsdc } from '../onchain-facts'
import { parseAmount } from '../onchain-money'

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
    const parsed = parseAmount(CHAIN_ID, usdcAmount)
    writeContract({
      ...JARA_WORK_ESCROW,
      functionName: 'createOrder',
      args: [orderId, title, description, sourceMarketplace, parsed.raw],
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
