import { type Account, Contract } from '@near-js/accounts'
import { actionCreators } from '@near-js/transactions'

import BN from 'bn.js'

import { type MPCSignature } from '../../signature/types'
import { type ChainSignatureContracts } from './types'
import { parseSignedDelegateForRelayer } from '../../relayer'
import { NEAR_MAX_GAS } from './constants'
import { near } from '..'
import {
  type SignArgs,
  ChainSignatureContract,
} from '../../chains/ChainSignatureContract'

export class ChainSignaturesContract extends ChainSignatureContract {
  private readonly account: Account
  private readonly contractId: ChainSignatureContracts

  constructor(account: Account, contractId: ChainSignatureContracts) {
    super()
    this.account = account
    this.contractId = contractId
  }

  private getContract(): Contract & {
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
  } {
    return new Contract(this.account, this.contractId, {
      viewMethods: [
        'public_key',
        'experimental_signature_deposit',
        'derived_public_key',
      ],
      changeMethods: ['sign'],
      useLocalViewExecution: false,
    }) as any
  }

  async public_key(): Promise<string> {
    const contract = this.getContract()
    return await contract.public_key()
  }

  async experimental_signature_deposit(): Promise<number> {
    const contract = this.getContract()
    return await contract.experimental_signature_deposit()
  }

  async derived_public_key(args: {
    path: string
    predecessor: string
  }): Promise<string> {
    const contract = this.getContract()
    return await contract.derived_public_key(args)
  }

  async sign(args: SignArgs): Promise<MPCSignature> {
    const contract = this.getContract()
    const deposit = new BN(
      (await this.experimental_signature_deposit()).toLocaleString('fullwide', {
        useGrouping: false,
      })
    )

    const signature = await contract.sign({
      args: { request: args },
      gas: NEAR_MAX_GAS,
      amount: deposit,
    })

    return signature
  }

  static async signWithRelayer({
    account,
    contract,
    signArgs,
    deposit,
    relayerUrl,
  }: {
    account: Account
    contract: ChainSignatureContracts
    signArgs: SignArgs
    deposit: BN
    relayerUrl: string
  }): Promise<MPCSignature> {
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

    const signature = near.transactionBuilder.responseToMpcSignature({
      response: txStatus,
    })

    if (!signature) {
      throw new Error('Signature error, please retry')
    }

    return signature
  }
}
