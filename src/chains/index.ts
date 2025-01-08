export { Chain } from './Chain'
export { ChainSignatureContract, type SignArgs } from './ChainSignatureContract'
export * from './types'

// EVM
export { EVM } from './EVM/EVM'

export { fetchEVMFeeProperties } from './EVM/utils'

export type { EVMTransactionRequest, EVMUnsignedTransaction } from './EVM/types'

// Bitcoin
export { Bitcoin } from './Bitcoin/Bitcoin'

export { BTCRpcAdapters, BTCRpcAdapter } from './Bitcoin/BTCRpcAdapter'

export type {
  BTCTransactionRequest,
  BTCUnsignedTransaction,
  BTCTransaction,
  BTCOutput,
  BTCInput,
  BTCNetworkIds,
} from './Bitcoin/types'

// Cosmos
export { Cosmos } from './Cosmos/Cosmos'

export type {
  CosmosNetworkIds,
  CosmosTransactionRequest,
  CosmosUnsignedTransaction,
} from './Cosmos/types'
