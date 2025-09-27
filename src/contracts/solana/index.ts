import * as errors from './errors'
import * as ChainSignaturesContractIdl from './types/chain_signatures_project.json'
export * from './ChainSignaturesContract'
export type { ChainSignaturesProject } from './types/chain_signatures_project'

const utils = {
  ChainSignaturesContractIdl,
  errors,
}

export { utils }
