import { type MPCSignature } from '../signature'

export interface SignArgs {
  payload: number[]
  path: string
  key_version: number
}

export abstract class ChainSignatureContract {
  abstract public_key(): Promise<string>

  abstract experimental_signature_deposit(): Promise<number>

  abstract derived_public_key(
    args: {
      path: string
      predecessor: string
    } & Record<string, unknown>
  ): Promise<string>

  abstract sign(args: SignArgs & Record<string, unknown>): Promise<MPCSignature>
}
