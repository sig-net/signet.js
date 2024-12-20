import {
  type BTCTransactionRequest,
  type BTCNetworkIds,
  type CosmosNetworkIds,
  type CosmosTransactionRequest,
} from '../..'
import type { EVMTransactionRequest } from '../../chains/EVM/types'
import type { KeyDerivationPath } from '../../signature'

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
