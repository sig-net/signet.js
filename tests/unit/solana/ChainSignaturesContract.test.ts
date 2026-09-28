import { type AnchorProvider } from '@coral-xyz/anchor'
import { type Connection, PublicKey, Transaction } from '@solana/web3.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ChainSignatureContract } from '../../../src/contracts/solana/ChainSignaturesContract'
import { SolanaEventPoller } from '../../../src/contracts/solana/SolanaEventPoller'

const programId = 'SigDHT99hPznk4d9SAxWLoBnKWT8jcob5pV8X7ti8SM'
const connection = () => ({
  rpcEndpoint: 'http://localhost:8899',
  commitment: 'confirmed' as const,
  getLatestBlockhash: vi.fn().mockResolvedValue({
    blockhash: '11111111111111111111111111111111',
    lastValidBlockHeight: 101,
  }),
  sendRawTransaction: vi.fn().mockResolvedValue('signature'),
  getSignatureStatuses: vi.fn().mockResolvedValue({ value: [null] }),
  getSlot: vi.fn().mockResolvedValue(100),
  getSignaturesForAddress: vi.fn().mockResolvedValue([]),
  getParsedTransaction: vi.fn().mockResolvedValue(null),
  getBlockHeight: vi.fn().mockResolvedValue(100),
})
const contractWith = (
  rpc: ReturnType<typeof connection>,
  signTransaction: (tx: Transaction) => Promise<Transaction>
) =>
  new ChainSignatureContract({
    provider: {
      connection: rpc,
      wallet: { publicKey: PublicKey.default, signTransaction },
    } as unknown as AnchorProvider,
    programId,
  })

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('confirmation service lifecycle', () => {
  it('refuses to broadcast and creates no confirmer when closed while signing', async () => {
    const rpc = connection()
    const contract: ChainSignatureContract = contractWith(rpc, async (tx) => {
      contract.close()
      return tx
    })
    await expect(
      contract.sendAndConfirmWithoutWebSocket(new Transaction())
    ).rejects.toThrow('Contract closed')
    expect(rpc.sendRawTransaction).not.toHaveBeenCalled()
    // A confirmer built after close() would own timers nothing ever clears.
    expect(vi.getTimerCount()).toBe(0)
  })

  it('refuses to broadcast when the contract was closed before submission', async () => {
    const rpc = connection()
    const contract = contractWith(rpc, async (tx) => tx)
    contract.close()
    await expect(
      contract.sendAndConfirmWithoutWebSocket(new Transaction())
    ).rejects.toThrow('closed')
    expect(rpc.sendRawTransaction).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('confirms a broadcast transaction through the shared confirmer', async () => {
    const rpc = connection()
    rpc.getSignatureStatuses.mockResolvedValue({
      value: [{ confirmationStatus: 'confirmed', err: null }],
    })
    const contract = contractWith(rpc, async (tx) => tx)
    const transaction = new Transaction()
    // Signing is stubbed, so serialization has no signature to check.
    vi.spyOn(transaction, 'serialize').mockReturnValue(Buffer.alloc(0))
    const confirmed = contract.sendAndConfirmWithoutWebSocket(transaction)
    await vi.advanceTimersByTimeAsync(1000)
    expect(await confirmed).toBe('signature')
    contract.close()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('response window', () => {
  it('does not spend the response window on wallet approval', async () => {
    const rpc = connection()
    const eventPoller = new SolanaEventPoller({
      connection: rpc as unknown as Connection,
      programId,
      pollIntervalMs: 100,
    })
    const contract = new ChainSignatureContract({
      provider: {
        connection: rpc,
        wallet: {
          publicKey: PublicKey.default,
          // A hardware wallet or a human approving a prompt can take minutes.
          signTransaction: async (tx: Transaction) => {
            await new Promise((resolve) => setTimeout(resolve, 200_000))
            vi.spyOn(tx, 'serialize').mockReturnValue(Buffer.alloc(0))
            return tx
          },
        },
      } as unknown as AnchorProvider,
      programId,
      eventPoller,
    })
    const signed = contract.sign({
      payload: Array(32).fill(1),
      path: '',
      key_version: 0,
    })
    void signed.catch(() => undefined)
    await vi.advanceTimersByTimeAsync(200_000)
    // The waiter outlives approval: its deadline starts after submission.
    expect(eventPoller.stats.pendingWaiters).toBe(1)
    contract.close()
    eventPoller.close()
    await expect(signed).rejects.toThrow()
  })
})
