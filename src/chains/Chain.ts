import { type KeyDerivationPath, type RSVSignature } from '../signature/types'
import { type MPCPayloads } from './types'

export interface Chain<TransactionRequest, UnsignedTransaction> {
  /**
   * Gets the balance for a given address
   */
  getBalance: (address: string) => Promise<string>

  /**
   * Derives an address and public key from a signer ID and derivation path
   */
  deriveAddressAndPublicKey: (
    signerId: string,
    path: KeyDerivationPath
  ) => Promise<{
    address: string
    publicKey: string
  }>

  /**
   * Stores a transaction in local storage
   */
  setTransaction: (transaction: UnsignedTransaction, storageKey: string) => void

  /**
   * Retrieves a transaction from local storage
   */
  getTransaction: (
    storageKey: string,
    options?: {
      remove?: boolean
    }
  ) => UnsignedTransaction | undefined

  /**
   * Gets the MPC payload and transaction for signing
   */
  getMPCPayloadAndTransaction: (
    transactionRequest: TransactionRequest
  ) => Promise<{
    transaction: UnsignedTransaction
    mpcPayloads: MPCPayloads
  }>

  /**
   * Gets the current signature deposit for the chain
   */
  addSignature: (params: {
    transaction: UnsignedTransaction
    mpcSignatures: RSVSignature[]
  }) => string

  /**
   * Broadcasts a transaction
   */
  broadcastTx: (txSerialized: string) => Promise<string>
}
