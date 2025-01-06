import type BN from 'bn.js'

import type { RSVSignature, UncompressedPubKeySEC1 } from '@chains/types'

export interface SignArgs {
  /** The payload to sign as an array of 32 bytes */
  payload: number[]
  /** The derivation path for key generation */
  path: string
  /** Version of the key to use */
  key_version: number
}

export abstract class ChainSignatureContract {
  /**
   * Gets the current signature deposit required by the contract.
   * This deposit amount helps manage network congestion.
   *
   * @returns Promise resolving to the required deposit amount as a BigNumber
   */
  abstract getCurrentSignatureDeposit(): Promise<BN>

  /**
   * Gets the root public key associated with this contract.
   * This is the root public key from which child keys can be derived.
   *
   * @returns Promise resolving to the SEC1 uncompressed public key
   */
  abstract getPublicKey(): Promise<UncompressedPubKeySEC1>

  /**
   * Signs a payload using Sig Network MPC.
   *
   * @param args - Arguments for the signing operation
   * @param args.payload - The data to sign as an array of 32 bytes
   * @param args.path - The string path to use derive the key
   * @param args.key_version - Version of the key to use
   * @returns Promise resolving to the RSV signature
   */
  abstract sign(args: SignArgs & Record<string, unknown>): Promise<RSVSignature>

  /**
   * Derives a child public key using a derivation path and predecessor.
   *
   * @param args - Arguments for key derivation
   * @param args.path - The string path to use derive the key
   * @param args.predecessor - The id/address of the account requesting signature
   * @returns Promise resolving to the derived SEC1 uncompressed public key
   */
  abstract getDerivedPublicKey(
    args: {
      path: string
      predecessor: string
    } & Record<string, unknown>
  ): Promise<UncompressedPubKeySEC1>
}
