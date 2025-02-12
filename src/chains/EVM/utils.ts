import { createPublicClient, http, type TransactionRequest } from 'viem'

export interface EVMFeeProperties {
  gas: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
}

export async function fetchEVMFeeProperties(
  providerUrl: string,
  transaction: TransactionRequest
): Promise<EVMFeeProperties> {
  const client = createPublicClient({
    transport: http(providerUrl),
  })

  const [gas, feeData] = await Promise.all([
    client.estimateGas(transaction),
    client.estimateFeesPerGas(),
  ])

  const maxFeePerGas = feeData.maxFeePerGas ?? BigInt(10_000_000_000) // 10 gwei
  const maxPriorityFeePerGas =
    feeData.maxPriorityFeePerGas ?? BigInt(10_000_000_000) // 10 gwei

  return {
    gas,
    maxFeePerGas,
    maxPriorityFeePerGas,
  }
}
