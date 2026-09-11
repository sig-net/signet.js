import { EventParser, type Idl, type Program } from '@coral-xyz/anchor'
import { hex } from '@scure/base'
import type { Connection, PublicKey } from '@solana/web3.js'

import { CpiEventParser } from './CpiEventParser'
import { SignatureNotFoundError } from './errors'
import type {
  ChainSignaturesEvent,
  ChainSignaturesEventName,
  EventData,
} from './types/events'

/**
 * Every event this watcher can deliver is emitted by one of the program's
 * `respond*` instructions, and Anchor logs the instruction name at the top of
 * each invocation. A log stream without this line cannot carry a wanted event,
 * so the transaction behind it is never fetched.
 */
const RESPOND_INSTRUCTION_LOG = 'Program log: Instruction: Respond'

const DEFAULT_BACKFILL_INTERVAL_MS = 30_000
const DEFAULT_BACKFILL_LIMIT = 50
const DEFAULT_HEALTH_CHECK_INTERVAL_MS = 10_000
const FAST_BACKFILL_INTERVAL_MS = 5_000
const DEFAULT_RECENT_EVENTS_LIMIT = 1_000
const SEEN_SIGNATURES_LIMIT = 5_000

export interface EventWatcherOptions {
  connection: Connection
  program: Program<Idl>
  /** The account whose log stream is watched, normally the program itself. */
  address: PublicKey
  /**
   * Delivered events are retained by request id so a waiter that registers
   * after its event has already been seen resolves immediately. Bounds memory
   * on a long-running process.
   */
  recentEventsLimit?: number
}

export interface WaitForEventOptions {
  /** Backfill scans only transactions after this signature. */
  afterSignature?: string
  timeoutMs?: number
  /** Interval of the always-on backfill scan. The tightest active waiter wins. */
  backfillIntervalMs?: number
  /** Signatures fetched per backfill scan. The largest active waiter wins. */
  backfillLimit?: number
  /** Interval of the RPC liveness probe. The tightest active waiter wins. */
  healthCheckIntervalMs?: number
  signal?: AbortSignal
}

interface Waiter {
  key: string
  resolve: (data: ChainSignaturesEvent['data']) => void
  reject: (error: Error) => void
  backfillIntervalMs: number
  backfillLimit: number
  healthCheckIntervalMs: number
  cleanup: Array<() => void>
}

/** Insertion-ordered set that evicts its oldest members past a fixed size. */
class BoundedSet<T> {
  private readonly items = new Set<T>()

  constructor(private readonly limit: number) {}

  has(item: T): boolean {
    return this.items.has(item)
  }

  add(item: T): void {
    this.items.add(item)
    if (this.items.size > this.limit) {
      const oldest = this.items.values().next().value as T
      this.items.delete(oldest)
    }
  }

  delete(item: T): void {
    this.items.delete(item)
  }
}

/**
 * Delivers chain-signatures events to any number of concurrent waiters over a
 * single log subscription and a single backfill loop.
 *
 * Cost is proportional to the program's transaction rate, not to the number of
 * waiters times that rate: each transaction seen is fetched at most once and
 * its events are dispatched to every waiter keyed on their request id.
 *
 * Three layers keep delivery reliable: a websocket log subscription for
 * latency, a periodic backfill over `getSignaturesForAddress` for anything the
 * socket dropped, and a liveness probe that resubscribes and tightens the
 * backfill while the RPC looks unhealthy. The subscription and timers run only
 * while at least one waiter is registered.
 */
export class EventWatcher {
  private readonly connection: Connection
  private readonly program: Program<Idl>
  private readonly address: PublicKey
  private readonly parser: EventParser

  private readonly waiters = new Map<string, Set<Waiter>>()
  private readonly recent = new Map<string, ChainSignaturesEvent['data']>()
  private readonly recentLimit: number
  private readonly seenSignatures = new BoundedSet<string>(
    SEEN_SIGNATURES_LIMIT
  )
  private lastCheckedSignature?: string

  private subscriptionId?: number
  private lastLogAt = 0
  private healthCheckTimer?: ReturnType<typeof setInterval>
  private backfillTimer?: ReturnType<typeof setInterval>
  private fastBackfillTimer?: ReturnType<typeof setInterval>
  private backfillInFlight?: Promise<void>
  private activeBackfillIntervalMs = DEFAULT_BACKFILL_INTERVAL_MS
  private activeHealthCheckIntervalMs = DEFAULT_HEALTH_CHECK_INTERVAL_MS

  constructor(options: EventWatcherOptions) {
    this.connection = options.connection
    this.program = options.program
    this.address = options.address
    this.recentLimit = options.recentEventsLimit ?? DEFAULT_RECENT_EVENTS_LIMIT
    this.parser = new EventParser(this.program.programId, this.program.coder)
  }

  /** Number of waiters currently registered. */
  get pending(): number {
    let count = 0
    for (const set of this.waiters.values()) count += set.size
    return count
  }

  /** Whether the log subscription and timers are running. */
  get active(): boolean {
    return this.subscriptionId !== undefined
  }

  /**
   * Resolves with the event named `eventName` whose request id is `requestId`,
   * or rejects with `SignatureNotFoundError` on timeout.
   */
  async waitForEvent<E extends ChainSignaturesEventName>(
    eventName: E,
    requestId: string,
    options: WaitForEventOptions = {}
  ): Promise<EventData<E>> {
    const key = EventWatcher.key(eventName, requestId)

    const recent = this.recent.get(key)
    if (recent !== undefined) return recent as EventData<E>

    if (options.signal?.aborted) {
      throw options.signal.reason ?? new Error('Aborted')
    }

    return await new Promise<EventData<E>>((resolve, reject) => {
      const waiter: Waiter = {
        key,
        resolve: (data) => {
          resolve(data as EventData<E>)
        },
        reject,
        backfillIntervalMs:
          options.backfillIntervalMs ?? DEFAULT_BACKFILL_INTERVAL_MS,
        backfillLimit: options.backfillLimit ?? DEFAULT_BACKFILL_LIMIT,
        healthCheckIntervalMs:
          options.healthCheckIntervalMs ?? DEFAULT_HEALTH_CHECK_INTERVAL_MS,
        cleanup: [],
      }

      const timeoutId = setTimeout(() => {
        this.remove(waiter)
        reject(new SignatureNotFoundError(requestId))
      }, options.timeoutMs ?? 60_000)
      waiter.cleanup.push(() => {
        clearTimeout(timeoutId)
      })

      if (options.signal) {
        const signal = options.signal
        const onAbort = (): void => {
          this.remove(waiter)
          reject(signal.reason ?? new Error('Aborted'))
        }
        signal.addEventListener('abort', onAbort, { once: true })
        waiter.cleanup.push(() => {
          signal.removeEventListener('abort', onAbort)
        })
      }

      // The first waiter's transaction is the natural lower bound for the
      // scan. Later waiters do not move the cursor backwards: everything the
      // scan has already covered is in the recent-events cache.
      if (this.lastCheckedSignature === undefined && options.afterSignature) {
        this.lastCheckedSignature = options.afterSignature
      }

      this.add(waiter)
    })
  }

  private static key(eventName: string, requestId: string): string {
    return `${eventName}:${requestId.toLowerCase()}`
  }

  private add(waiter: Waiter): void {
    let set = this.waiters.get(waiter.key)
    if (!set) {
      set = new Set()
      this.waiters.set(waiter.key, set)
    }
    set.add(waiter)
    this.reconcileTimers()
    if (!this.active) this.start()
  }

  private remove(waiter: Waiter): void {
    for (const fn of waiter.cleanup) {
      try {
        fn()
      } catch {}
    }
    const set = this.waiters.get(waiter.key)
    if (set) {
      set.delete(waiter)
      if (set.size === 0) this.waiters.delete(waiter.key)
    }
    if (this.waiters.size === 0) {
      this.stop()
    } else {
      this.reconcileTimers()
    }
  }

  private remember(key: string, data: ChainSignaturesEvent['data']): void {
    this.recent.set(key, data)
    if (this.recent.size > this.recentLimit) {
      const oldest = this.recent.keys().next().value as string
      this.recent.delete(oldest)
    }
  }

  private dispatch(events: ChainSignaturesEvent[]): void {
    for (const event of events) {
      const requestId = '0x' + hex.encode(new Uint8Array(event.data.requestId))
      const key = EventWatcher.key(event.name, requestId)
      this.remember(key, event.data)

      const set = this.waiters.get(key)
      if (!set) continue
      for (const waiter of [...set]) {
        this.remove(waiter)
        waiter.resolve(event.data)
      }
    }
  }

  private markSeen(signature: string): boolean {
    if (this.seenSignatures.has(signature)) return false
    this.seenSignatures.add(signature)
    return true
  }

  /**
   * Fetches one transaction and dispatches its events. Returns false when the
   * fetch failed, in which case the signature is forgotten so a later scan
   * fetches it again.
   */
  private async fetchAndDispatch(signature: string): Promise<boolean> {
    let tx
    try {
      tx = await this.connection.getParsedTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      })
    } catch {
      this.seenSignatures.delete(signature)
      return false
    }
    if (!tx) return true

    const events = CpiEventParser.parseCpiEventsFromTransaction(
      tx,
      this.program.programId.toString(),
      this.program
    )
    const logs = tx.meta?.logMessages
    if (logs) {
      for (const evt of this.parser.parseLogs(logs)) {
        if (evt) events.push(evt as ChainSignaturesEvent)
      }
    }
    this.dispatch(events)
    return true
  }

  // --- Layer 1: log subscription -------------------------------------------

  private subscribe(): void {
    this.subscriptionId = this.connection.onLogs(
      this.address,
      (logs) => {
        this.lastLogAt = Date.now()
        if (logs.err) return
        if (!this.markSeen(logs.signature)) return

        // `emit!`-style events are in the log lines themselves and cost no
        // extra call to decode.
        const inline: ChainSignaturesEvent[] = []
        for (const evt of this.parser.parseLogs(logs.logs)) {
          if (evt) inline.push(evt as ChainSignaturesEvent)
        }
        if (inline.length > 0) this.dispatch(inline)

        // `emit_cpi!` events live in inner instructions, which only a fetch
        // reveals. Only a respond instruction can carry one.
        const canCarryEvent = logs.logs.some((line) =>
          line.startsWith(RESPOND_INSTRUCTION_LOG)
        )
        if (!canCarryEvent) return

        void this.fetchAndDispatch(logs.signature)
      },
      'confirmed'
    )
  }

  private unsubscribe(): void {
    if (this.subscriptionId === undefined) return
    void this.connection
      .removeOnLogsListener(this.subscriptionId)
      .catch(() => undefined)
    this.subscriptionId = undefined
  }

  // --- Layer 2: backfill -----------------------------------------------------

  private backfill(): Promise<void> {
    // One scan at a time; a slow RPC must not stack overlapping scans.
    if (this.backfillInFlight) return this.backfillInFlight
    this.backfillInFlight = this.runBackfill().finally(() => {
      this.backfillInFlight = undefined
    })
    return this.backfillInFlight
  }

  private async runBackfill(): Promise<void> {
    if (this.waiters.size === 0) return
    let limit = DEFAULT_BACKFILL_LIMIT
    for (const set of this.waiters.values()) {
      for (const waiter of set) limit = Math.max(limit, waiter.backfillLimit)
    }

    try {
      const signatures = await this.connection.getSignaturesForAddress(
        this.address,
        { until: this.lastCheckedSignature, limit },
        'confirmed'
      )
      if (signatures.length === 0) return

      // Newest first from the RPC; oldest first here so waiters resolve in
      // the order their events landed.
      let complete = true
      for (const sig of [...signatures].reverse()) {
        if (this.waiters.size === 0) return
        if (sig.err) continue
        if (!this.markSeen(sig.signature)) continue
        if (!(await this.fetchAndDispatch(sig.signature))) complete = false
      }

      // The cursor advances only past a fully processed batch; a failed fetch
      // keeps these signatures in range for the next scan, where the seen-set
      // skips the ones that succeeded.
      if (complete) this.lastCheckedSignature = signatures[0].signature
    } catch {
      // Transient RPC failures are retried on the next scan.
    }
  }

  // --- Layer 3: liveness -----------------------------------------------------

  private startFastBackfill(): void {
    if (this.fastBackfillTimer !== undefined) return
    this.fastBackfillTimer = setInterval(() => {
      void this.backfill()
    }, FAST_BACKFILL_INTERVAL_MS)
  }

  private stopFastBackfill(): void {
    if (this.fastBackfillTimer === undefined) return
    clearInterval(this.fastBackfillTimer)
    this.fastBackfillTimer = undefined
  }

  private healthCheck(): void {
    void this.connection
      .getSlot('confirmed')
      .then(() => {
        const quiet = Date.now() - this.lastLogAt
        if (quiet < this.activeHealthCheckIntervalMs * 3) {
          this.stopFastBackfill()
        }
      })
      .catch(() => {
        this.unsubscribe()
        this.subscribe()
        this.startFastBackfill()
      })
  }

  /**
   * Timers follow the tightest interval any registered waiter asked for, so a
   * caller that needs prompt backfill is not held to another caller's slower
   * default.
   */
  private reconcileTimers(): void {
    let backfillMs = Infinity
    let healthMs = Infinity
    for (const set of this.waiters.values()) {
      for (const waiter of set) {
        backfillMs = Math.min(backfillMs, waiter.backfillIntervalMs)
        healthMs = Math.min(healthMs, waiter.healthCheckIntervalMs)
      }
    }
    if (!Number.isFinite(backfillMs)) return

    if (backfillMs !== this.activeBackfillIntervalMs) {
      this.activeBackfillIntervalMs = backfillMs
      if (this.backfillTimer !== undefined) {
        clearInterval(this.backfillTimer)
        this.backfillTimer = setInterval(() => {
          void this.backfill()
        }, backfillMs)
      }
    }
    if (healthMs !== this.activeHealthCheckIntervalMs) {
      this.activeHealthCheckIntervalMs = healthMs
      if (this.healthCheckTimer !== undefined) {
        clearInterval(this.healthCheckTimer)
        this.healthCheckTimer = setInterval(() => {
          this.healthCheck()
        }, healthMs)
      }
    }
  }

  private start(): void {
    this.lastLogAt = Date.now()
    this.subscribe()
    this.healthCheckTimer = setInterval(() => {
      this.healthCheck()
    }, this.activeHealthCheckIntervalMs)
    this.backfillTimer = setInterval(() => {
      void this.backfill()
    }, this.activeBackfillIntervalMs)
  }

  private stop(): void {
    this.unsubscribe()
    if (this.healthCheckTimer !== undefined) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = undefined
    }
    if (this.backfillTimer !== undefined) {
      clearInterval(this.backfillTimer)
      this.backfillTimer = undefined
    }
    this.stopFastBackfill()
  }
}
