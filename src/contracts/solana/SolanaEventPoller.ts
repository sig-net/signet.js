import { EventParser, Program, type Idl } from '@coral-xyz/anchor'
import { hex } from '@scure/base'
import {
  PublicKey,
  type Connection,
  type ConfirmedSignatureInfo,
} from '@solana/web3.js'

import { CpiEventParser } from './CpiEventParser'
import { SignatureNotFoundError } from './errors'
import { boundedRpc, HttpPollingLoop } from './HttpPollingLoop'
import IDL from './types/chain_signatures_project.json'
import type {
  ChainSignaturesEvent,
  ChainSignaturesEventName,
  EventData,
} from './types/events'

export interface SolanaEventPollerOptions {
  connection: Connection
  programId: PublicKey | string
  idl?: Idl
  pollIntervalMs?: number
  rpcTimeoutMs?: number
  pageSize?: number
  fetchConcurrency?: number
  maxPendingTransactions?: number
  recentEventsLimit?: number
}

export interface PollerWaitOptions {
  timeoutMs?: number
  signal?: AbortSignal
  /** Initial history boundary when the poller has not started yet. */
  afterSignature?: string
}

interface Waiter {
  resolve: (event: ChainSignaturesEvent['data']) => void
  reject: (error: unknown) => void
  deadline: number
  requestId: string
  cleanup: () => void
}

/**
 * One HTTP discovery stream per program. Start before submitting requests;
 * registrations share fetching, decoding and retries for the service lifetime.
 * State survives loop restarts in memory. Process recovery requires replay from
 * application-owned durable job records; this class does not persist jobs.
 */
export class SolanaEventPoller {
  readonly programId: PublicKey
  readonly connection: Connection
  private readonly program: Program<Idl>
  private readonly parser: EventParser
  private readonly loop: HttpPollingLoop
  private readonly waiters = new Map<string, Set<Waiter>>()
  private readonly recent = new Map<string, ChainSignaturesEvent['data']>()
  private readonly queue = new Map<string, ConfirmedSignatureInfo>()
  private readonly seen = new Set<string>()
  private cursor?: string
  private initialSlot?: number
  private scan?: { head?: string; before?: string }
  private ready?: Promise<void>
  private closed = false
  private readonly lifecycle = new AbortController()
  private readonly sweep: ReturnType<typeof setInterval>
  private readonly rpcTimeoutMs: number
  private readonly pageSize: number
  private readonly concurrency: number
  private readonly maxPending: number
  private readonly recentLimit: number

  constructor(options: SolanaEventPollerOptions) {
    this.connection = options.connection
    this.programId = new PublicKey(options.programId)
    this.program = new Program(
      { ...(options.idl ?? IDL), address: this.programId.toString() } as Idl,
      { connection: this.connection }
    )
    this.parser = new EventParser(this.programId, this.program.coder)
    this.rpcTimeoutMs = options.rpcTimeoutMs ?? 15_000
    this.pageSize = options.pageSize ?? 100
    this.concurrency = options.fetchConcurrency ?? 8
    this.maxPending = options.maxPendingTransactions ?? 10_000
    this.recentLimit = options.recentEventsLimit ?? 1_000
    for (const value of [
      this.rpcTimeoutMs,
      this.pageSize,
      this.concurrency,
      this.maxPending,
      this.recentLimit,
    ]) {
      if (!Number.isInteger(value) || value < 1)
        throw new Error('Poller limits must be positive integers')
    }
    if (this.pageSize > 1000 || this.maxPending < this.pageSize)
      throw new Error('Invalid page/queue size')
    this.loop = new HttpPollingLoop(
      (signal) => this.tick(signal),
      options.pollIntervalMs ?? 2_000
    )
    this.sweep = setInterval(() => this.expire(), 250)
  }

  get stats() {
    let pendingWaiters = 0
    for (const entries of this.waiters.values()) pendingWaiters += entries.size
    return {
      running: this.loop.running,
      pendingWaiters,
      pendingTransactions: this.queue.size,
      cursor: this.cursor,
      lastSuccessAt: this.loop.lastSuccessAt,
      lastError: this.loop.lastError,
      restarts: this.loop.restarts,
    }
  }

  /** Establish a boundary before broadcasting any request to be observed. */
  start(afterSignature?: string): Promise<void> {
    if (this.closed) return Promise.reject(new Error('Event poller is closed'))
    this.ready ??= (async () => {
      if (afterSignature) this.cursor = afterSignature
      else
        this.initialSlot = await boundedRpc(
          () => this.connection.getSlot('confirmed'),
          this.lifecycle.signal,
          this.rpcTimeoutMs
        )
      if (this.closed) throw new Error('Event poller is closed')
      this.loop.start()
    })().catch((error) => {
      this.ready = undefined
      throw error
    })
    return this.ready
  }

  /** Restart observation without discarding waiters, the queue or the cursor. */
  restart(): void {
    if (this.closed) throw new Error('Event poller is closed')
    if (!this.loop.running)
      throw new Error('Start the poller before restarting it')
    this.loop.restart()
  }

  waitForEvent<E extends ChainSignaturesEventName>(
    eventName: E,
    requestId: string,
    options: PollerWaitOptions = {}
  ): Promise<EventData<E>> {
    if (this.closed) return Promise.reject(new Error('Event poller is closed'))
    if (options.signal?.aborted) return Promise.reject(options.signal.reason)
    const key = `${eventName}:${requestId.toLowerCase()}`
    const cached = this.recent.get(key)
    if (cached) return Promise.resolve(cached as EventData<E>)
    return new Promise<EventData<E>>((resolve, reject) => {
      const set = this.waiters.get(key) ?? new Set<Waiter>()
      this.waiters.set(key, set)
      const remove = (): void => {
        set.delete(waiter)
        if (set.size === 0 && this.waiters.get(key) === set)
          this.waiters.delete(key)
        options.signal?.removeEventListener('abort', abort)
      }
      const abort = (): void => {
        remove()
        reject(options.signal?.reason ?? new Error('Aborted'))
      }
      const waiter: Waiter = {
        resolve: (data) => resolve(data as EventData<E>),
        reject,
        deadline: Date.now() + (options.timeoutMs ?? 60_000),
        requestId,
        cleanup: remove,
      }
      set.add(waiter)
      options.signal?.addEventListener('abort', abort, { once: true })
      void this.start(options.afterSignature).catch((error) => {
        remove()
        reject(error)
      })
    })
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.lifecycle.abort(new Error('Event poller closed'))
    this.loop.stop()
    clearInterval(this.sweep)
    for (const set of this.waiters.values())
      for (const waiter of [...set]) {
        waiter.cleanup()
        waiter.reject(new Error('Event poller closed'))
      }
    this.queue.clear()
    this.recent.clear()
    this.seen.clear()
  }

  private expire(): void {
    for (const set of this.waiters.values())
      for (const waiter of [...set]) {
        if (Date.now() >= waiter.deadline) {
          waiter.cleanup()
          waiter.reject(new SignatureNotFoundError(waiter.requestId))
        }
      }
  }

  private dispatch(events: ChainSignaturesEvent[]): void {
    for (const event of events) {
      if (
        ![
          'signatureRespondedEvent',
          'signatureErrorEvent',
          'respondBidirectionalEvent',
        ].includes(event.name)
      )
        continue
      const key = `${event.name}:0x${hex.encode(new Uint8Array(event.data.requestId))}`
      this.recent.set(key, event.data)
      while (this.recent.size > this.recentLimit)
        this.recent.delete(this.recent.keys().next().value!)
      for (const waiter of [...(this.waiters.get(key) ?? [])]) {
        waiter.cleanup()
        waiter.resolve(event.data)
      }
    }
  }

  private async discover(signal: AbortSignal): Promise<void> {
    if (this.queue.size + this.pageSize > this.maxPending) return
    this.scan ??= {}
    const scan = this.scan
    const page = await boundedRpc(
      () =>
        this.connection.getSignaturesForAddress(
          this.programId,
          {
            before: scan.before,
            until: this.cursor,
            limit: this.pageSize,
          },
          'confirmed'
        ),
      signal,
      this.rpcTimeoutMs
    )
    scan.head ??= page[0]?.signature
    let complete = page.length < this.pageSize
    for (const entry of page) {
      if (
        entry.signature === this.cursor ||
        (this.initialSlot !== undefined && entry.slot < this.initialSlot)
      ) {
        complete = true
        break
      }
      if (!entry.err && !this.seen.has(entry.signature))
        this.queue.set(entry.signature, entry)
    }
    if (complete) {
      this.cursor = scan.head ?? this.cursor
      this.scan = undefined
    } else {
      scan.before = page[page.length - 1].signature
    }
  }

  private async tick(signal: AbortSignal): Promise<void> {
    // Discovery and processing can fail independently; queued work still drains
    // when signature listing fails, and a missing transaction stays queued.
    let failure: unknown
    try {
      await this.discover(signal)
    } catch (error) {
      failure = error
    }
    if (signal.aborted) throw signal.reason
    const batch = [...this.queue.keys()].slice(0, this.pageSize)
    const results: PromiseSettledResult<void>[] = []
    for (let offset = 0; offset < batch.length; offset += this.concurrency) {
      results.push(
        ...(await Promise.allSettled(
          batch
            .slice(offset, offset + this.concurrency)
            .map(async (signature) => {
              const tx = await boundedRpc(
                () =>
                  this.connection.getParsedTransaction(signature, {
                    commitment: 'confirmed',
                    maxSupportedTransactionVersion: 0,
                  }),
                signal,
                this.rpcTimeoutMs
              )
              if (!tx)
                throw new Error(`Transaction ${signature} is not available yet`)
              if (!tx.meta?.err) {
                const events = CpiEventParser.parseCpiEventsFromTransaction(
                  tx,
                  this.programId.toString(),
                  this.program
                )
                if (tx.meta?.logMessages)
                  for (const event of this.parser.parseLogs(
                    tx.meta.logMessages
                  ))
                    events.push(event as ChainSignaturesEvent)
                this.dispatch(events)
              }
              this.queue.delete(signature)
              this.seen.add(signature)
              while (this.seen.size > this.maxPending * 2)
                this.seen.delete(this.seen.values().next().value!)
            })
        ))
      )
      if (signal.aborted) throw signal.reason
    }
    if (signal.aborted) throw signal.reason
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.status === 'rejected') {
        // Rotate failed work so one unavailable transaction cannot starve others.
        const signature = batch[i]
        const entry = this.queue.get(signature)
        if (entry) {
          this.queue.delete(signature)
          this.queue.set(signature, entry)
        }
        failure ??= result.reason
      }
    }
    if (failure) throw failure
  }
}
