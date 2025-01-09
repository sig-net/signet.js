import type {
  KeyDerivationPath,
  MPCPayloads,
  RSVSignature,
} from '@chains/types'

export abstract class Chain<TransactionRequest, UnsignedTransaction> {
  /**
   * Gets the native token balance for a given address
   *
   * @param address - The address to check
   * @returns Promise resolving to the balance as a string, formatted according to the chain's decimal places (e.g. ETH, BTC, etc.)
   */
  abstract getBalance(address: string): Promise<string>

  /**
   * Uses Sig Network Key Derivation Function to derive the address and public key. from a signer ID and string path.
   *
   * @param predecessor - The id/address of the account requesting signature
   * @param path - The string path used to derive the key
   * @returns Promise resolving to the derived address and public key
   */
  abstract deriveAddressAndPublicKey(
    predecessor: string,
    path: KeyDerivationPath
  ): Promise<{
    address: string
    publicKey: string
  }>

  /**
   * Stores an unsigned transaction in local storage for later use.
   * Particularly useful for browser-based wallets that redirects the user to a different page.
   *
   * @param transaction - The unsigned transaction to store
   * @param storageKey - Unique key to identify the stored transaction
   */
  abstract setTransaction(
    transaction: UnsignedTransaction,
    storageKey: string
  ): void

  /**
   * Retrieves a previously stored transaction from local storage.
   *
   * @param storageKey - The key used to store the transaction
   * @param options - Additional options
   * @param options.remove - If true, removes the transaction from storage after retrieval
   * @returns The stored transaction or undefined if not found
   */
  abstract getTransaction(
    storageKey: string,
    options?: {
      remove?: boolean
    }
  ): UnsignedTransaction | undefined

  /**
   * Prepares a transaction for Sig Network MPC signing by creating the necessary payloads.
   * This method handles chain-specific transaction preparation including:
   * - Fee calculation
   * - Nonce/sequence management
   * - UTXO selection (for UTXO-based chains)
   * - Transaction encoding
   *
   * @param transactionRequest - The transaction request containing parameters like recipient, amount, etc.
   * @returns Promise resolving to an object containing:
   *          - transaction: The unsigned transaction
   *          - mpcPayloads: Array of payloads to be signed by MPC. The order of these payloads must match
   *                         the order of signatures provided to addSignature()
   */
  abstract getMPCPayloadAndTransaction(
    transactionRequest: TransactionRequest
  ): Promise<{
    transaction: UnsignedTransaction
    mpcPayloads: MPCPayloads
  }>

  /**
   * Adds Sig Network MPC-generated signatures to an unsigned transaction.
   *
   * @param params - Parameters for adding signatures
   * @param params.transaction - The unsigned transaction to add signatures to
   * @param params.mpcSignatures - Array of RSV signatures generated through MPC. Must be in the same order
   *                              as the payloads returned by getMPCPayloadAndTransaction()
   * @returns The serialized signed transaction ready for broadcast
   */
  abstract addSignature(params: {
    transaction: UnsignedTransaction
    mpcSignatures: RSVSignature[]
  }): string

  /**
   * Broadcasts a signed transaction to the network.
   *
   * @param txSerialized - The serialized signed transaction
   * @returns Promise resolving to the transaction hash/ID
   */
  abstract broadcastTx(txSerialized: string): Promise<string>
}
