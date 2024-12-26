import type BN from 'bn.js'
import type { RSVSignature, UncompressedPubKeySEC1 } from '@chains'

/**
 * Arguments for the sign method
 */
export interface SignArgs {
  /** The payload to sign as an array of 32 bytes */
  payload: number[]
  /** The derivation path for key generation */
  path: string
  /** Version of the key to use */
  key_version: number
}

/**
 * Abstract class defining the interface for chain signature contracts.
 * This contract handles MPC (Multi-Party Computation) operations for secure key derivation and signing.
 * It serves as a bridge between the blockchain implementations and the MPC infrastructure.
 */
export abstract class ChainSignatureContract {
  /**
   * Gets the current signature deposit required by the contract.
   * This deposit amount helps manage network congestion.
   *
   * @returns Promise resolving to the required deposit amount as a BigNumber
   * @throws Error if the deposit check fails
   */
  abstract getCurrentSignatureDeposit(): Promise<BN>

  /**
   * Gets the public key associated with this contract.
   * This is the root public key from which child keys can be derived.
   *
   * @returns Promise resolving to the uncompressed public key
   * @throws Error if public key retrieval fails
   */
  abstract getPublicKey(): Promise<UncompressedPubKeySEC1>

  /**
   * Signs a payload using MPC.
   * This is the core signing operation that coordinates with the MPC infrastructure.
   *
   * @param args - Arguments for the signing operation
   * @param args.payload - The data to sign
   * @param args.path - Derivation path for the signing key
   * @param args.key_version - Version of the key to use
   * @returns Promise resolving to the RSV signature
   * @throws Error if signing fails or is rejected
   */
  abstract sign(args: SignArgs & Record<string, unknown>): Promise<RSVSignature>

  /**
   * Derives a child public key using a derivation path and predecessor.
   * This method implements hierarchical deterministic key derivation.
   *
   * @param args - Arguments for key derivation
   * @param args.path - The derivation path to use
   * @param args.predecessor - The predecessor key (usually a NEAR account) that controls this derived key
   * @returns Promise resolving to the derived uncompressed public key
   * @throws Error if key derivation fails
   */
  abstract getDerivedPublicKey(
    args: {
      path: string
      predecessor: string
    } & Record<string, unknown>
  ): Promise<UncompressedPubKeySEC1>
}
