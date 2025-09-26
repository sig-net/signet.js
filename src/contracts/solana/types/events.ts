import { type PublicKey } from '@solana/web3.js'

interface AffinePoint {
  x: number[]
  y: number[]
}

interface Signature {
  bigR: AffinePoint
  s: number[]
  recoveryId: number
}

export interface SignatureRespondedEvent {
  requestId: number[]
  responder: PublicKey
  signature: Signature
}

export interface SignatureErrorEvent {
  requestId: number[]
  responder: PublicKey
  error: string
}

export type ChainSignaturesEventName =
  | 'signatureRespondedEvent'
  | 'signatureErrorEvent'

export type ChainSignaturesEvent =
  | { name: 'signatureRespondedEvent'; data: SignatureRespondedEvent }
  | { name: 'signatureErrorEvent'; data: SignatureErrorEvent }

export interface ChainSignaturesEventHandlers {
  signatureRespondedEvent?: (
    event: SignatureRespondedEvent,
    slot: number
  ) => Promise<void> | void
  signatureErrorEvent?: (
    event: SignatureErrorEvent,
    slot: number
  ) => Promise<void> | void
}
