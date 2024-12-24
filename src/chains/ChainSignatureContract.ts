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
  abstract getCurrentSignatureDeposit(): Promise<BN>
  abstract getPublicKey(): Promise<UncompressedPublicKey>
  abstract sign(args: SignArgs & Record<string, unknown>): Promise<RSVSignature>
  abstract getDerivedPublicKey(
    args: {
      path: string
      predecessor: string
    } & Record<string, unknown>
  ): Promise<UncompressedPublicKey>
}
