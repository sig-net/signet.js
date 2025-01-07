import { type Account, Contract } from '@near-js/accounts'
import { KeyPair } from '@near-js/crypto'
import { actionCreators } from '@near-js/transactions'
import BN from 'bn.js'
import { base_decode } from 'near-api-js/lib/utils/serialize'

import { utils } from '@chains'
import { ChainSignatureContract as AbstractChainSignatureContract } from '@chains/ChainSignatureContract'
import type { SignArgs } from '@chains/ChainSignatureContract'
import type {
  RSVSignature,
  MPCSignature,
  UncompressedPubKeySEC1,
} from '@chains/types'
import { chains } from '@utils'
import { getNearAccount } from '@utils/chains/near/account'
import {
  DONT_CARE_ACCOUNT_ID,
  NEAR_MAX_GAS,
} from '@utils/chains/near/constants'
import { parseSignedDelegateForRelayer } from '@utils/chains/near/relayer'
import {
  type NearNetworkIds,
  type ChainSignatureContractIds,
} from '@utils/chains/near/types'

const najToUncompressedPubKey = (najPubKey: string): UncompressedPubKeySEC1 => {
  return `04${Buffer.from(base_decode(najPubKey.split(':')[1])).toString('hex')}`
}

const requireAccount = (accountId: string): void => {
  if (accountId === DONT_CARE_ACCOUNT_ID) {
    throw new Error(
      'A valid account ID and keypair are required for change methods. Please instantiate a new contract with valid credentials.'
    )
  }
}

type NearContract = Contract & {
  public_key: () => Promise<string>
  sign: (args: {
    args: { request: SignArgs }
    gas: BN
    amount: BN
  }) => Promise<MPCSignature>
  experimental_signature_deposit: () => Promise<number>
  derived_public_key: (args: {
    path: string
    predecessor: string
  }) => Promise<string>
}

interface ChainSignatureContractArgs {
  networkId: NearNetworkIds
  contractId: ChainSignatureContractIds
  accountId?: string
  keypair?: KeyPair
}

/**
 * This contract will default to view methods only.
 * If you want to use the change methods, you need to provide an account and keypair.
 */
export class ChainSignatureContract extends AbstractChainSignatureContract {
  private readonly networkId: NearNetworkIds
  private readonly contractId: ChainSignatureContractIds
  private readonly accountId: string
  private readonly keypair: KeyPair

  constructor({
    networkId,
    contractId,
    accountId = DONT_CARE_ACCOUNT_ID,
    keypair = KeyPair.fromRandom('ed25519'),
  }: ChainSignatureContractArgs) {
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
    return najToUncompressedPubKey(najPubKey)
  }

  async sign(args: SignArgs): Promise<RSVSignature> {
    requireAccount(this.accountId)

    const contract = await this.getContract()
    const deposit = await this.getCurrentSignatureDeposit()

    const signature = await contract.sign({
      args: { request: args },
      gas: NEAR_MAX_GAS,
      amount: deposit,
    })

    return utils.toRSV(signature)
  }

  static async signWithRelayer({
    account,
    contract,
    signArgs,
    deposit,
    relayerUrl,
  }: {
    account: Account
    contract: ChainSignatureContractIds
    signArgs: SignArgs
    deposit: BN
    relayerUrl: string
  }): Promise<RSVSignature> {
    const functionCall = actionCreators.functionCall(
      'sign',
      { request: signArgs },
      BigInt(NEAR_MAX_GAS.toString()),
      BigInt(deposit.toString())
    )

    const signedDelegate = await account.signedDelegate({
      receiverId: contract,
      actions: [functionCall],
      blockHeightTtl: 60,
    })

    // Remove the cached access key to prevent nonce reuse
    delete account.accessKeyByPublicKeyCache[
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      signedDelegate.delegateAction.publicKey.toString()
    ]

    const res = await fetch(`${relayerUrl}/send_meta_tx_async`, {
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify(parseSignedDelegateForRelayer(signedDelegate)),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    })

    const txHash = await res.text()
    const txStatus = await account.connection.provider.txStatus(
      txHash,
      account.accountId,
      'FINAL'
    )

    const signature = chains.near.transactionBuilder.responseToMpcSignature({
      response: txStatus,
    })

    if (!signature) {
      throw new Error('Signature error, please retry')
    }

    return signature
  }
}
