import { type KeyDerivationPath, type RSVSignature } from '../signature/types'
import { type MPCPayloads } from './types'

/**
 * Core interface for blockchain implementations.
 * Provides a standardized way to interact with different blockchain networks through a common set of methods.
 *
 * @typeParam TransactionRequest - The type of transaction request specific to the blockchain
 * @typeParam UnsignedTransaction - The type of unsigned transaction specific to the blockchain
 */
export interface Chain<TransactionRequest, UnsignedTransaction> {
  /**
   * Gets the native token balance for a given address
   *
   * @param address - The blockchain address to check
   * @returns Promise resolving to the balance as a string, formatted according to the chain's decimal places
   * @throws Error if the balance fetch fails or the address is invalid
   */
  getBalance: (address: string) => Promise<string>

  /**
   * Derives an address and public key from a signer ID and derivation path.
   * Uses MPC (Multi-Party Computation) to derive the key pair securely.
   *
   * @param predecessor - The ID of the signer that controls the derived key
   * @param path - The derivation path that uniquely identifies this key pair
   * @returns Promise resolving to the derived address and its corresponding public key
   * @throws Error if key derivation fails or the signer ID is invalid
   */
  deriveAddressAndPublicKey: (
    predecessor: string,
    path: KeyDerivationPath
  ) => Promise<{
    address: string
    publicKey: string
  }>

  /**
   * Stores an unsigned transaction in local storage for later use.
   * This method persists transaction data between page reloads and browser sessions.
   * Particularly useful for browser-based wallets that need to maintain transaction state.
   *
   * @param transaction - The unsigned transaction to store
   * @param storageKey - Unique key to identify the stored transaction
   */
  setTransaction: (transaction: UnsignedTransaction, storageKey: string) => void

  /**
   * Retrieves a previously stored transaction from local storage.
   *
   * @param storageKey - The key used to store the transaction
   * @param options - Additional options
   * @param options.remove - If true, removes the transaction from storage after retrieval
   * @returns The stored transaction or undefined if not found
   */
  getTransaction: (
    storageKey: string,
    options?: {
      remove?: boolean
    }
  ) => UnsignedTransaction | undefined

  /**
   * Prepares a transaction for MPC signing by creating the necessary payloads.
   * This method handles chain-specific transaction preparation including:
   * - Fee calculation
   * - Nonce/sequence management
   * - UTXO selection (for UTXO-based chains)
   * - Transaction encoding
   *
   * @param transactionRequest - The transaction request containing parameters like recipient, amount, etc.
   * @returns Promise resolving to the unsigned transaction and MPC payloads for signing
   * @throws Error if transaction preparation fails
   */
  getMPCPayloadAndTransaction: (
    transactionRequest: TransactionRequest
  ) => Promise<{
    transaction: UnsignedTransaction
    mpcPayloads: MPCPayloads
  }>

  /**
   * Adds MPC-generated signatures to an unsigned transaction.
   * The signatures are applied according to the chain's specific signing scheme.
   *
   * @param params - Parameters for adding signatures
   * @param params.transaction - The unsigned transaction to sign
   * @param params.mpcSignatures - Array of RSV signatures generated through MPC
   * @returns The serialized signed transaction ready for broadcast
   * @throws Error if signature application fails
   */
  addSignature: (params: {
    transaction: UnsignedTransaction
    mpcSignatures: RSVSignature[]
  }) => string

  /**
   * Broadcasts a signed transaction to the network.
   *
   * @param txSerialized - The serialized signed transaction
   * @returns Promise resolving to the transaction hash/ID
   * @throws Error if broadcast fails or transaction is rejected
   */
  broadcastTx: (txSerialized: string) => Promise<string>
}
