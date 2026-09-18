import {
  type Connection,
  PublicKey,
  type ParsedTransactionWithMeta,
} from '@solana/web3.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CpiEventParser } from '../../../src/contracts/solana/CpiEventParser'
import { HttpTransactionConfirmer } from '../../../src/contracts/solana/HttpTransactionConfirmer'
import { SolanaEventPoller } from '../../../src/contracts/solana/SolanaEventPoller'
import type { ChainSignaturesEvent } from '../../../src/contracts/solana/types/events'

const programId = PublicKey.default
const event = (id: number): ChainSignaturesEvent => ({
  name: 'signatureErrorEvent',
  data: { requestId: [id], responder: programId, error: `result-${id}` },
})
const signature = (name: string, slot = 100) => ({
  signature: name,
  slot,
  err: null,
  memo: null,
  blockTime: null,
  confirmationStatus: 'confirmed' as const,
})
const transaction = (id: number) =>
  ({
    slot: id,
    meta: { err: null, logMessages: [] },
  }) as unknown as ParsedTransactionWithMeta
let poller: SolanaEventPoller | undefined
let confirmer: HttpTransactionConfirmer | undefined
const connection = () => ({
  rpcEndpoint: 'http://localhost:8899',
  getSlot: vi.fn().mockResolvedValue(100),
  getSignaturesForAddress: vi.fn().mockResolvedValue([]),
  getParsedTransaction: vi.fn().mockResolvedValue(transaction(1)),
  getSignatureStatuses: vi.fn().mockResolvedValue({ value: [] }),
  getBlockHeight: vi.fn().mockResolvedValue(100),
  onLogs: vi.fn(() => {
    throw new Error('WebSocket forbidden')
  }),
  onSignature: vi.fn(() => {
    throw new Error('WebSocket forbidden')
  }),
})
const create = (rpc: ReturnType<typeof connection>, extra = {}) =>
  (poller = new SolanaEventPoller({
    connection: rpc as unknown as Connection,
    programId,
    pollIntervalMs: 100,
    rpcTimeoutMs: 50,
    ...extra,
  }))
const flush = () => vi.advanceTimersByTimeAsync(1)

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(CpiEventParser, 'parseCpiEventsFromTransaction').mockImplementation(
    (tx) => [event(tx!.slot)]
  )
})
afterEach(() => {
  poller?.close()
  confirmer?.close()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('shared HTTP event observation', () => {
  it('shares scans and decoding across 1000 waiters and stays alive between runs', async () => {
    const rpc = connection()
    create(rpc)
    await poller!.start()
    await flush()
    const waits = Array.from({ length: 1000 }, () =>
      poller!.waitForEvent('signatureErrorEvent', '0x01')
    )
    rpc.getSignaturesForAddress.mockResolvedValueOnce([signature('one')])
    await vi.advanceTimersByTimeAsync(100)
    expect(await Promise.all(waits)).toHaveLength(1000)
    expect(rpc.getParsedTransaction).toHaveBeenCalledTimes(1)
    expect(CpiEventParser.parseCpiEventsFromTransaction).toHaveBeenCalledTimes(
      1
    )
    expect(poller!.stats.pendingWaiters).toBe(0)
    expect(poller!.stats.running).toBe(true)
    const second = poller!.waitForEvent('signatureErrorEvent', '0x02')
    rpc.getParsedTransaction.mockResolvedValueOnce(transaction(2))
    rpc.getSignaturesForAddress.mockResolvedValueOnce([signature('two')])
    await vi.advanceTimersByTimeAsync(100)
    expect((await second).error).toBe('result-2')
    expect(rpc.getSlot).toHaveBeenCalledTimes(1)
    expect(rpc.onLogs).not.toHaveBeenCalled()
    expect(rpc.onSignature).not.toHaveBeenCalled()
  })

  it('paginates a burst before committing its discovery cursor', async () => {
    const rpc = connection()
    rpc.getSignaturesForAddress
      .mockResolvedValueOnce([signature('c'), signature('b')])
      .mockResolvedValueOnce([signature('a')])
    create(rpc, { pageSize: 2 })
    await poller!.start('boundary')
    await flush()
    expect(poller!.stats.cursor).toBe('boundary')
    await vi.advanceTimersByTimeAsync(100)
    expect(rpc.getSignaturesForAddress.mock.calls[1][1]).toEqual({
      before: 'b',
      until: 'boundary',
      limit: 2,
    })
    expect(poller!.stats.cursor).toBe('c')
    expect(rpc.getParsedTransaction).toHaveBeenCalledTimes(3)
  })

  it('retries a failed history page without skipping its remaining signatures', async () => {
    const rpc = connection()
    rpc.getSignaturesForAddress
      .mockResolvedValueOnce([signature('c'), signature('b')])
      .mockRejectedValueOnce(new Error('429'))
      .mockResolvedValueOnce([signature('a')])
    create(rpc, { pageSize: 2 })
    await poller!.start('boundary')
    await flush()
    await vi.advanceTimersByTimeAsync(100)
    expect(poller!.stats.cursor).toBe('boundary')
    await vi.advanceTimersByTimeAsync(250)
    expect(rpc.getSignaturesForAddress.mock.calls[2][1].before).toBe('b')
    expect(poller!.stats.cursor).toBe('c')
    expect(rpc.getParsedTransaction).toHaveBeenCalledTimes(3)
  })

  it('ignores an old generation fetch after an explicit restart', async () => {
    const rpc = connection()
    let finish!: (value: unknown) => void
    rpc.getSignaturesForAddress.mockResolvedValueOnce([signature('one')])
    rpc.getParsedTransaction.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    create(rpc)
    const waiting = poller!.waitForEvent('signatureErrorEvent', '0x01')
    await flush()
    poller!.restart()
    await flush()
    expect((await waiting).error).toBe('result-1')
    finish(transaction(2))
    await flush()
    expect(CpiEventParser.parseCpiEventsFromTransaction).toHaveBeenCalledTimes(
      1
    )
    expect(poller!.stats.pendingTransactions).toBe(0)
  })

  it('retains unavailable transactions across loop restarts', async () => {
    const rpc = connection()
    rpc.getSignaturesForAddress.mockResolvedValueOnce([signature('one')])
    rpc.getParsedTransaction.mockResolvedValueOnce(null)
    create(rpc)
    const wait = poller!.waitForEvent('signatureErrorEvent', '0x01')
    await flush()
    expect(poller!.stats.pendingTransactions).toBe(1)
    poller!.restart()
    await flush()
    expect((await wait).error).toBe('result-1')
    expect(poller!.stats.pendingTransactions).toBe(0)
    expect(poller!.stats.restarts).toBe(1)
  })

  it('recovers from a hung listing RPC and ignores its late result', async () => {
    const rpc = connection()
    let finish!: (value: unknown) => void
    rpc.getSignaturesForAddress.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    create(rpc)
    await poller!.start('boundary')
    await vi.advanceTimersByTimeAsync(60)
    expect(poller!.stats.lastError).toContain('exceeded')
    rpc.getSignaturesForAddress.mockResolvedValueOnce([signature('good')])
    await vi.advanceTimersByTimeAsync(250)
    expect(poller!.stats.cursor).toBe('good')
    finish([signature('late')])
    await flush()
    expect(poller!.stats.cursor).toBe('good')
    expect(rpc.getParsedTransaction.mock.calls.flat()).not.toContain('late')
  })

  it('dispatches every event in a transaction and ignores failed transactions', async () => {
    const rpc = connection()
    rpc.getSignaturesForAddress.mockResolvedValueOnce([
      signature('one'),
      signature('failed'),
    ])
    rpc.getParsedTransaction
      .mockResolvedValueOnce(transaction(1))
      .mockResolvedValueOnce({ meta: { err: 'failed' } })
    vi.mocked(CpiEventParser.parseCpiEventsFromTransaction).mockReturnValue([
      event(1),
      event(2),
    ])
    create(rpc)
    const first = poller!.waitForEvent('signatureErrorEvent', '0x01')
    const second = poller!.waitForEvent('signatureErrorEvent', '0x02')
    await flush()
    expect((await first).error).toBe('result-1')
    expect((await second).error).toBe('result-2')
    expect(CpiEventParser.parseCpiEventsFromTransaction).toHaveBeenCalledTimes(
      1
    )
  })

  it('isolates cancellation and expires waits even during an RPC outage', async () => {
    const rpc = connection()
    rpc.getSignaturesForAddress.mockRejectedValue(new Error('429'))
    create(rpc)
    const abort = new AbortController()
    const first = poller!.waitForEvent('signatureErrorEvent', '0x01', {
      signal: abort.signal,
    })
    const firstRejected = expect(first).rejects.toThrow('cancelled')
    const second = poller!.waitForEvent('signatureErrorEvent', '0x02', {
      timeoutMs: 300,
    })
    const secondRejected = expect(second).rejects.toThrow()
    abort.abort(new Error('cancelled'))
    await firstRejected
    expect(poller!.stats.pendingWaiters).toBe(1)
    await vi.advanceTimersByTimeAsync(500)
    await secondRejected
    expect(poller!.stats.pendingWaiters).toBe(0)
    expect(poller!.stats.running).toBe(true)
  })

  it('close rejects waits and stops all timers', async () => {
    const rpc = connection()
    create(rpc)
    const waiting = poller!.waitForEvent('signatureErrorEvent', '0x01')
    const rejected = expect(waiting).rejects.toThrow('closed')
    await flush()
    poller!.close()
    await rejected
    const calls = rpc.getSignaturesForAddress.mock.calls.length
    await vi.advanceTimersByTimeAsync(10_000)
    expect(rpc.getSignaturesForAddress).toHaveBeenCalledTimes(calls)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('HTTP transaction confirmation', () => {
  it('batches requests, preserves processed transactions past expiry, and uses no WebSockets', async () => {
    const rpc = connection()
    confirmer = new HttpTransactionConfirmer(rpc as unknown as Connection)
    const waits = Array.from({ length: 300 }, (_, i) =>
      confirmer!.wait(String(i), 101)
    )
    rpc.getSignatureStatuses.mockImplementation(async (hashes: string[]) => ({
      value: hashes.map(() => ({ confirmationStatus: 'processed', err: null })),
    }))
    await flush()
    expect(confirmer.pendingCount).toBe(300)
    rpc.getSignatureStatuses.mockImplementation(async (hashes: string[]) => ({
      value: hashes.map(() => ({ confirmationStatus: 'confirmed', err: null })),
    }))
    await vi.advanceTimersByTimeAsync(1000)
    expect(await Promise.all(waits)).toHaveLength(300)
    expect(
      rpc.getSignatureStatuses.mock.calls.every(
        ([hashes]) => hashes.length <= 256
      )
    ).toBe(true)
    expect(rpc.onSignature).not.toHaveBeenCalled()
  })

  it('rejects an expired unobserved transaction', async () => {
    const rpc = connection()
    rpc.getSignatureStatuses.mockResolvedValue({ value: [null] })
    rpc.getBlockHeight.mockResolvedValue(102)
    confirmer = new HttpTransactionConfirmer(rpc as unknown as Connection)
    const failed = expect(confirmer.wait('expired', 101)).rejects.toThrow(
      'block height exceeded'
    )
    await flush()
    await failed
  })
})
