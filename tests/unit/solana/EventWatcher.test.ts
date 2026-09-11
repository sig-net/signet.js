import {
  Program,
  Wallet,
  utils as anchorUtils,
  type Idl,
  type Provider,
} from '@coral-xyz/anchor'
import { hex } from '@scure/base'
import {
  Keypair,
  PublicKey,
  type Logs,
  type ParsedTransactionWithMeta,
} from '@solana/web3.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { constants, contracts } from '../../../src'
import IDL from '../../../src/contracts/solana/types/chain_signatures_project.json'

const PROGRAM_ID = new PublicKey(constants.CONTRACT_ADDRESSES.SOLANA.TESTNET)

// Sha256("anchor:event")[..8], the discriminator of the self-CPI that
// `emit_cpi!` issues.
const EMIT_CPI_DISCRIMINATOR = [0xe4, 0x45, 0xa5, 0x2e, 0x51, 0xcb, 0x9a, 0x1d]

const RESPONDED_DISCRIMINATOR = IDL.events.find(
  (e) => e.name === 'SignatureRespondedEvent'
)!.discriminator

const RESPOND_LOGS = [
  `Program ${PROGRAM_ID} invoke [1]`,
  'Program log: Instruction: Respond',
  `Program ${PROGRAM_ID} invoke [2]`,
  `Program ${PROGRAM_ID} success`,
  `Program ${PROGRAM_ID} success`,
]

const SIGN_LOGS = [
  `Program ${PROGRAM_ID} invoke [1]`,
  'Program log: Instruction: Sign',
  `Program ${PROGRAM_ID} success`,
]

type LogsCallback = (logs: Logs, context: { slot: number }) => void

/**
 * The slice of `Connection` the watcher touches, recording every call so a
 * test can assert how much RPC work a scenario cost.
 */
class FakeConnection {
  readonly listeners = new Map<number, LogsCallback>()
  readonly fetched: string[] = []
  readonly transactions = new Map<string, ParsedTransactionWithMeta>()
  /** Returned by getSignaturesForAddress, newest first, like the RPC. */
  history: Array<{ signature: string; err: unknown }> = []
  historyCalls = 0
  slotFails = false
  private nextId = 1

  onLogs(_address: PublicKey, callback: LogsCallback): number {
    const id = this.nextId++
    this.listeners.set(id, callback)
    return id
  }

  async removeOnLogsListener(id: number): Promise<void> {
    this.listeners.delete(id)
  }

  async getParsedTransaction(
    signature: string
  ): Promise<ParsedTransactionWithMeta | null> {
    this.fetched.push(signature)
    return this.transactions.get(signature) ?? null
  }

  async getSignaturesForAddress(): Promise<
    Array<{ signature: string; err: unknown }>
  > {
    this.historyCalls++
    return this.history
  }

  async getSlot(): Promise<number> {
    if (this.slotFails) throw new Error('rpc down')
    return 1
  }

  emit(signature: string, logs: string[], err: unknown = null): void {
    for (const callback of this.listeners.values()) {
      callback({ signature, err: err as Logs['err'], logs }, { slot: 1 })
    }
  }
}

interface RespondedEvent {
  requestId: Uint8Array
  responder: PublicKey
  x: Uint8Array
  y: Uint8Array
  s: Uint8Array
  recoveryId: number
}

const randomBytes = (n: number): Uint8Array =>
  Uint8Array.from({ length: n }, () => Math.floor(Math.random() * 256))

const respondedEvent = (): RespondedEvent => ({
  requestId: randomBytes(32),
  responder: Keypair.generate().publicKey,
  x: randomBytes(32),
  y: randomBytes(32),
  s: randomBytes(32),
  recoveryId: 1,
})

const requestIdOf = (event: RespondedEvent): string =>
  '0x' + hex.encode(event.requestId)

/** Borsh layout of `SignatureRespondedEvent`, wrapped as `emit_cpi!` data. */
const cpiInstructionData = (event: RespondedEvent): string =>
  anchorUtils.bytes.bs58.encode(
    Buffer.concat([
      Buffer.from(EMIT_CPI_DISCRIMINATOR),
      Buffer.from(RESPONDED_DISCRIMINATOR),
      Buffer.from(event.requestId),
      event.responder.toBuffer(),
      Buffer.from(event.x),
      Buffer.from(event.y),
      Buffer.from(event.s),
      Buffer.from([event.recoveryId]),
    ])
  )

const respondTransaction = (
  events: RespondedEvent[]
): ParsedTransactionWithMeta =>
  ({
    meta: {
      logMessages: RESPOND_LOGS,
      innerInstructions: [
        {
          index: 0,
          instructions: events.map((event) => ({
            programId: PROGRAM_ID,
            data: cpiInstructionData(event),
            accounts: [],
          })),
        },
      ],
    },
  }) as unknown as ParsedTransactionWithMeta

const makeProgram = (connection: FakeConnection): Program<Idl> =>
  new Program({ ...(IDL as Idl), address: PROGRAM_ID.toString() }, {
    connection,
  } as unknown as Provider)

const flush = async (): Promise<void> => {
  // Dispatch runs after two awaits: the fetch, then the parse.
  await new Promise((resolve) => setImmediate(resolve))
  await new Promise((resolve) => setImmediate(resolve))
}

describe('EventWatcher', () => {
  let connection: FakeConnection
  let watcher: contracts.solana.EventWatcher

  beforeEach(() => {
    connection = new FakeConnection()
    watcher = new contracts.solana.EventWatcher({
      connection: connection as never,
      program: makeProgram(connection),
      address: PROGRAM_ID,
    })
  })

  it('serves many waiters from one subscription and one fetch per transaction', async () => {
    const a = respondedEvent()
    const b = respondedEvent()
    connection.transactions.set('tx1', respondTransaction([a, b]))

    const waitA = watcher.waitForEvent(
      'signatureRespondedEvent',
      requestIdOf(a)
    )
    const waitB = watcher.waitForEvent(
      'signatureRespondedEvent',
      requestIdOf(b)
    )
    expect(connection.listeners.size).toBe(1)
    expect(watcher.pending).toBe(2)

    connection.emit('tx1', RESPOND_LOGS)
    const [eventA, eventB] = await Promise.all([waitA, waitB])

    expect(connection.fetched).toEqual(['tx1'])
    expect(hex.encode(new Uint8Array(eventA.signature.s))).toBe(hex.encode(a.s))
    expect(hex.encode(new Uint8Array(eventB.signature.s))).toBe(hex.encode(b.s))
    expect(eventA.responder.equals(a.responder)).toBe(true)

    await flush()
    expect(watcher.pending).toBe(0)
    expect(watcher.active).toBe(false)
    expect(connection.listeners.size).toBe(0)
  })

  it('does not fetch transactions that cannot carry a response', async () => {
    const event = respondedEvent()
    const wait = watcher.waitForEvent(
      'signatureRespondedEvent',
      requestIdOf(event),
      { timeoutMs: 50 }
    )

    connection.emit('sign1', SIGN_LOGS)
    connection.emit('sign2', SIGN_LOGS)
    connection.emit('failed', RESPOND_LOGS, { InstructionError: [0, 'x'] })
    await flush()

    expect(connection.fetched).toEqual([])
    await expect(wait).rejects.toBeInstanceOf(
      contracts.solana.utils.errors.SignatureNotFoundError
    )
  })

  it('fetches a transaction once even when the socket reports it twice', async () => {
    const event = respondedEvent()
    connection.transactions.set('tx1', respondTransaction([event]))
    const wait = watcher.waitForEvent(
      'signatureRespondedEvent',
      requestIdOf(event)
    )

    connection.emit('tx1', RESPOND_LOGS)
    connection.emit('tx1', RESPOND_LOGS)
    await wait

    expect(connection.fetched).toEqual(['tx1'])
  })

  it('resolves a waiter that registers after its event was seen', async () => {
    const early = respondedEvent()
    const late = respondedEvent()
    connection.transactions.set('tx1', respondTransaction([early, late]))

    const waitEarly = watcher.waitForEvent(
      'signatureRespondedEvent',
      requestIdOf(early)
    )
    connection.emit('tx1', RESPOND_LOGS)
    await waitEarly
    await flush()
    expect(watcher.active).toBe(false)

    const result = await watcher.waitForEvent(
      'signatureRespondedEvent',
      requestIdOf(late)
    )
    expect(hex.encode(new Uint8Array(result.signature.s))).toBe(
      hex.encode(late.s)
    )
    expect(connection.fetched).toEqual(['tx1'])
    expect(connection.listeners.size).toBe(0)
  })

  it('rejects on abort with the signal reason and tears down', async () => {
    const controller = new AbortController()
    const wait = watcher.waitForEvent(
      'signatureRespondedEvent',
      requestIdOf(respondedEvent()),
      { signal: controller.signal }
    )
    expect(watcher.active).toBe(true)

    controller.abort(new Error('caller gave up'))
    await expect(wait).rejects.toThrow('caller gave up')
    expect(watcher.active).toBe(false)
  })

  it('rejects immediately on an already aborted signal', async () => {
    const controller = new AbortController()
    controller.abort(new Error('too late'))
    await expect(
      watcher.waitForEvent(
        'signatureRespondedEvent',
        requestIdOf(respondedEvent()),
        { signal: controller.signal }
      )
    ).rejects.toThrow('too late')
    expect(watcher.active).toBe(false)
  })

  describe('with timers', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('backfills events the socket never delivered', async () => {
      const event = respondedEvent()
      connection.transactions.set('tx1', respondTransaction([event]))
      connection.history = [{ signature: 'tx1', err: null }]

      const wait = watcher.waitForEvent(
        'signatureRespondedEvent',
        requestIdOf(event),
        { backfillIntervalMs: 1_000, timeoutMs: 10_000 }
      )

      await vi.advanceTimersByTimeAsync(1_000)
      const result = await wait

      expect(connection.historyCalls).toBe(1)
      expect(connection.fetched).toEqual(['tx1'])
      expect(result.signature.recoveryId).toBe(1)
    })

    it('runs the shared backfill at the tightest interval any waiter asked for', async () => {
      const slow = watcher.waitForEvent(
        'signatureRespondedEvent',
        requestIdOf(respondedEvent()),
        { backfillIntervalMs: 30_000, timeoutMs: 60_000 }
      )
      const fast = watcher.waitForEvent(
        'signatureRespondedEvent',
        requestIdOf(respondedEvent()),
        { backfillIntervalMs: 1_000, timeoutMs: 60_000 }
      )

      const outcomes = Promise.all([
        expect(slow).rejects.toBeInstanceOf(
          contracts.solana.utils.errors.SignatureNotFoundError
        ),
        expect(fast).rejects.toBeInstanceOf(
          contracts.solana.utils.errors.SignatureNotFoundError
        ),
      ])

      await vi.advanceTimersByTimeAsync(3_000)
      expect(connection.historyCalls).toBe(3)

      await vi.advanceTimersByTimeAsync(60_000)
      await outcomes
      expect(watcher.active).toBe(false)
    })

    it('resubscribes when the RPC stops answering', async () => {
      const wait = watcher.waitForEvent(
        'signatureRespondedEvent',
        requestIdOf(respondedEvent()),
        { healthCheckIntervalMs: 1_000, timeoutMs: 5_000 }
      )
      const outcome = expect(wait).rejects.toBeInstanceOf(
        contracts.solana.utils.errors.SignatureNotFoundError
      )
      const firstId = [...connection.listeners.keys()][0]

      connection.slotFails = true
      await vi.advanceTimersByTimeAsync(1_000)

      expect(connection.listeners.size).toBe(1)
      expect([...connection.listeners.keys()][0]).not.toBe(firstId)

      await vi.advanceTimersByTimeAsync(5_000)
      await outcome
    })
  })
})

describe('ChainSignatureContract.waitForEvent', () => {
  it('maps a responded event to an RSV signature', async () => {
    const connection = new FakeConnection()
    const contract = new contracts.solana.ChainSignatureContract({
      provider: {
        connection,
        wallet: new Wallet(Keypair.generate()),
      } as never,
      programId: PROGRAM_ID,
    })

    const event = respondedEvent()
    connection.transactions.set('tx1', respondTransaction([event]))

    const wait = contract.waitForEvent({
      eventName: 'signatureRespondedEvent',
      requestId: requestIdOf(event),
      signer: contract.programId,
    })
    connection.emit('tx1', RESPOND_LOGS)

    await expect(wait).resolves.toEqual({
      r: hex.encode(event.x),
      s: hex.encode(event.s),
      v: 28,
    })
  })
})
