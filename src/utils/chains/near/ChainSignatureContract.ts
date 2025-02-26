import { Contract } from '@near-js/accounts'
import { KeyPair } from '@near-js/crypto'
import BN from 'bn.js'

import { ChainSignatureContract as AbstractChainSignatureContract } from '@chains/ChainSignatureContract'
import type { SignArgs } from '@chains/ChainSignatureContract'
import type {
  RSVSignature,
  MPCSignature,
  UncompressedPubKeySEC1,
  NajPublicKey,
} from '@chains/types'
import { cryptography } from '@utils'
import { getNearAccount } from '@utils/chains/near/account'
import {
  DONT_CARE_ACCOUNT_ID,
  NEAR_MAX_GAS,
} from '@utils/chains/near/constants'
import {
  type NearNetworkIds,
  type ChainSignatureContractIds,
} from '@utils/chains/near/types'
import { najToUncompressedPubKeySEC1 } from '@utils/cryptography'

const requireAccount = (accountId: string): void => {
  if (accountId === DONT_CARE_ACCOUNT_ID) {
    throw new Error(
      'A valid account ID and keypair are required for change methods. Please instantiate a new contract with valid credentials.'
    )
  }
}

type NearContract = Contract & {
  public_key: () => Promise<NajPublicKey>
  sign: (args: {
    args: { request: SignArgs }
    gas: BN
    amount: BN
  }) => Promise<MPCSignature>
  experimental_signature_deposit: () => Promise<number>
  derived_public_key: (args: {
    path: string
    predecessor: string
  }) => Promise<NajPublicKey>
}

interface ChainSignatureContractArgs {
  networkId: NearNetworkIds
  contractId: ChainSignatureContractIds
  accountId?: string
  keypair?: KeyPair
}

/**
 * Implementation of the ChainSignatureContract for NEAR chains.
 *
 * This class provides an interface to interact with the ChainSignatures contract
 * deployed on NEAR. It supports both view methods (which don't require authentication)
 * and change methods (which require a valid NEAR account and keypair).
 *
 * @extends AbstractChainSignatureContract
 */
export class ChainSignatureContract extends AbstractChainSignatureContract {
  private readonly networkId: NearNetworkIds
  private readonly contractId: ChainSignatureContractIds
  private readonly accountId: string
  private readonly keypair: KeyPair

  /**
   * Creates a new instance of the ChainSignatureContract for NEAR chains.
   *
   * @param args - Configuration options for the contract
   * @param args.networkId - The NEAR network ID (e.g. 'testnet', 'mainnet')
   * @param args.contractId - The contract ID of the deployed ChainSignatures contract
   * @param args.accountId - Optional NEAR account ID for signing transactions. Required for change methods.
   * @param args.keypair - Optional NEAR KeyPair for signing transactions. Required for change methods.
   */
  constructor({
    networkId,
    contractId,
    accountId = DONT_CARE_ACCOUNT_ID,
    keypair = KeyPair.fromRandom('ed25519'),
  }: ChainSignatureContractArgs) {
    // TODO: Should use the hardcoded ROOT_PUBLIC_KEY as in the EVM ChainSignatureContract
    super()

    this.networkId = networkId
    this.contractId = contractId
    this.accountId = accountId
    this.keypair = keypair
  }

  private async getContract(): Promise<NearContract> {
    const account = await getNearAccount({
      networkId: this.networkId,
      accountId: this.accountId,
      keypair: this.keypair,
    })

    return new Contract(account, this.contractId, {
      viewMethods: [
        'public_key',
        'experimental_signature_deposit',
        'derived_public_key',
      ],
      changeMethods: ['sign'],
      useLocalViewExecution: false,
    }) as unknown as NearContract
  }

  async getCurrentSignatureDeposit(): Promise<BN> {
    const contract = await this.getContract()
    return new BN(
      (await contract.experimental_signature_deposit()).toLocaleString(
        'fullwide',
        {
          useGrouping: false,
        }
      )
    )
  }

  async getDerivedPublicKey(args: {
    path: string
    predecessor: string
  }): Promise<UncompressedPubKeySEC1> {
    const contract = await this.getContract()

    const najPubKey = await contract.derived_public_key(args)
    return najToUncompressedPubKeySEC1(najPubKey)
  }

  async getPublicKey(): Promise<UncompressedPubKeySEC1> {
    const contract = await this.getContract()

    const najPubKey = await contract.public_key()
    return najToUncompressedPubKeySEC1(najPubKey)
  }

  // TODO: Should call the contract without the Contract instance as it doesn't allow for proper timeout handling on the BE
  async sign(args: SignArgs): Promise<RSVSignature> {
    requireAccount(this.accountId)

    const contract = await this.getContract()
    const deposit = await this.getCurrentSignatureDeposit()

    const signature = await contract.sign({
      args: { request: args },
      gas: NEAR_MAX_GAS,
      amount: deposit,
    })

    return cryptography.toRSV(signature)
  }
}
