import * as errors from './errors'
import * as ChainSignaturesContractIdl from './types/chain_signatures_project.json'
export * from './ChainSignaturesContract'
export { CpiEventParser } from './CpiEventParser'
export { EventWatcher } from './EventWatcher'
export type { EventWatcherOptions, WaitForEventOptions } from './EventWatcher'
export { getRequestIdRespond, getRequestIdBidirectional } from './utils'
export type {
  SolanaRequestIdArgs,
  SolanaBidirectionalRequestIdArgs,
} from './utils'
export type { ChainSignaturesProject } from './types/chain_signatures_project'
export type {
  AffinePoint,
  ChainSignaturesEvent,
  ChainSignaturesEventName,
  EventData,
  EventResult,
  EventResultMap,
  RespondBidirectionalData,
  RespondBidirectionalEvent,
  Signature,
  SignatureErrorEvent,
  SignatureRespondedEvent,
} from './types/events'

const utils = {
  ChainSignaturesContractIdl,
  errors,
}

export { utils }
