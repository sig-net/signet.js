import type {
  BTCTransactionRequest,
  BTCNetworkIds,
} from '@chains/Bitcoin/types'
import type {
  CosmosNetworkIds,
  CosmosTransactionRequest,
} from '@chains/Cosmos/types'
import { type EVMTransactionRequest } from '@chains/EVM/types'
import type { KeyDerivationPath } from '@chains/types'

/** 
Available ChainSignature contracts:
  - Mainnet: v1.signer
  - Testnet: v1.signer-prod.testnet
  - Development (unstable): v1.signer-dev.testnet
*/
export type ChainSignatureContractIds = string

export type NFTKeysContracts = string

export type NearNetworkIds = 'mainnet' | 'testnet'

export interface ChainProvider {
  providerUrl: string
  contract: ChainSignatureContractIds
}

export interface NearAuthentication {
  networkId: NearNetworkIds
  accountId: string
}

interface SuccessResponse {
  transactionHash: string
  success: true
}

interface FailureResponse {
  success: false
  errorMessage: string
}

export type Response = SuccessResponse | FailureResponse

export type EVMChainConfigWithProviders = ChainProvider

export interface EVMRequest {
  transaction: EVMTransactionRequest
  chainConfig: EVMChainConfigWithProviders
  nearAuthentication: NearAuthentication
  fastAuthRelayerUrl?: string
  derivationPath: KeyDerivationPath
}

export type BTCChainConfigWithProviders = ChainProvider & {
  network: BTCNetworkIds
}

export interface BitcoinRequest {
  transaction: BTCTransactionRequest
  chainConfig: BTCChainConfigWithProviders
  nearAuthentication: NearAuthentication
  fastAuthRelayerUrl?: string
  derivationPath: KeyDerivationPath
}

export interface CosmosChainConfig {
  contract: ChainSignatureContractIds
  chainId: CosmosNetworkIds
}

export interface CosmosRequest {
  chainConfig: CosmosChainConfig
  transaction: CosmosTransactionRequest
  nearAuthentication: NearAuthentication
  derivationPath: KeyDerivationPath
  fastAuthRelayerUrl?: string
}
