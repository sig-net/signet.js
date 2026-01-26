import { type PublicKey } from '@solana/web3.js'

import type { RSVSignature } from '@types'

import type { SignatureErrorData } from '../../evm/types'

export interface AffinePoint {
  x: number[]
  y: number[]
}

export interface Signature {
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

export interface RespondBidirectionalEvent {
  requestId: number[]
  responder: PublicKey
  serializedOutput: Buffer
  signature: Signature
}

export interface RespondBidirectionalData {
  serializedOutput: Buffer
  signature: Signature
}

export type ChainSignaturesEventName =
  | 'signatureRespondedEvent'
  | 'signatureErrorEvent'
  | 'respondBidirectionalEvent'

export type ChainSignaturesEvent =
  | { name: 'signatureRespondedEvent'; data: SignatureRespondedEvent }
  | { name: 'signatureErrorEvent'; data: SignatureErrorEvent }
  | { name: 'respondBidirectionalEvent'; data: RespondBidirectionalEvent }

export interface EventResultMap {
  signatureRespondedEvent: RSVSignature
  signatureErrorEvent: SignatureErrorData
  respondBidirectionalEvent: RespondBidirectionalData
}

export type EventResult<E extends ChainSignaturesEventName> = EventResultMap[E]

export type EventData<E extends ChainSignaturesEventName> =
  E extends 'signatureRespondedEvent'
    ? SignatureRespondedEvent
    : E extends 'signatureErrorEvent'
      ? SignatureErrorEvent
      : E extends 'respondBidirectionalEvent'
        ? RespondBidirectionalEvent
        : never
