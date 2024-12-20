export type { SLIP044ChainId, KeyDerivationPath } from './signature/types'
export type { Chain } from './chains/Chain'
export type { ChainSignatureContract } from './chains/ChainSignatureContract'
export { near } from './utils'

// EVM
export { EVM } from './chains/EVM/EVM'

export { fetchEVMFeeProperties } from './chains/EVM/utils'

export type {
  EVMTransactionRequest,
  EVMUnsignedTransaction,
} from './chains/EVM/types'

// Bitcoin
export { Bitcoin } from './chains/Bitcoin/Bitcoin'

export { fetchBTCFeeProperties } from './chains/Bitcoin/utils'

export type {
  BTCNetworkIds,
  BTCTransactionRequest,
  BTCUnsignedTransaction,
} from './chains/Bitcoin/types'

// Cosmos
export { Cosmos } from './chains/Cosmos/Cosmos'

export type {
  CosmosNetworkIds,
  CosmosTransactionRequest,
  CosmosUnsignedTransaction,
} from './chains/Cosmos/types'
