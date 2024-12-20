// import { type RSVSignature } from '../signature'
import type BN from 'bn.js'
import { type RSVSignature } from '../signature'
import { type UncompressedPublicKey } from './types'

export interface SignArgs {
  payload: number[]
  path: string
  key_version: number
}

export abstract class ChainSignatureContract {
  abstract experimental_signature_deposit(): Promise<BN>

  abstract public_key(): Promise<UncompressedPublicKey>

  abstract sign(args: SignArgs & Record<string, unknown>): Promise<RSVSignature>

  abstract derived_public_key(
    args: {
      path: string
      predecessor: string
    } & Record<string, unknown>
  ): Promise<UncompressedPublicKey>
}
