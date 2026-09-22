import {
  type Connection,
  TransactionExpiredBlockheightExceededError,
  TransactionExpiredTimeoutError,
} from '@solana/web3.js'

import { boundedRpc, HttpPollingLoop } from './HttpPollingLoop'

interface Confirmation {
  signature: string
  lastValidBlockHeight: number
  deadline: number
  timeoutMs: number
  resolve: (signature: string) => void
  reject: (error: unknown) => void
  cleanup: () => void
}

/** Batches HTTP status checks for all transactions submitted by an application. */
export class HttpTransactionConfirmer {
  private readonly pending = new Set<Confirmation>()
  private readonly loop: HttpPollingLoop
  private readonly sweep: ReturnType<typeof setInterval>
  private closed = false

  constructor(
    readonly connection: Connection,
    private readonly rpcTimeoutMs = 15_000
  ) {
    this.loop = new HttpPollingLoop((signal) => this.tick(signal), 1_000)
    this.sweep = setInterval(() => {
      for (const entry of [...this.pending])
        if (Date.now() >= entry.deadline) {
          entry.cleanup()
          entry.reject(
            new TransactionExpiredTimeoutError(
              entry.signature,
              entry.timeoutMs / 1000
            )
          )
        }
    }, 250)
  }

  get isClosed(): boolean {
    return this.closed
  }

  get pendingCount(): number {
    return this.pending.size
  }

  wait(
    signature: string,
    lastValidBlockHeight: number,
    options: { timeoutMs?: number; signal?: AbortSignal } = {}
  ): Promise<string> {
    if (this.closed)
      return Promise.reject(new Error('Transaction confirmer closed'))
    if (options.signal?.aborted) return Promise.reject(options.signal.reason)
    return new Promise((resolve, reject) => {
      const timeoutMs = options.timeoutMs ?? 60_000
      const cleanup = (): void => {
        this.pending.delete(entry)
        options.signal?.removeEventListener('abort', abort)
      }
      const abort = (): void => {
        cleanup()
        reject(options.signal?.reason)
      }
      const entry: Confirmation = {
        signature,
        lastValidBlockHeight,
        timeoutMs,
        deadline: Date.now() + timeoutMs,
        resolve,
        reject,
        cleanup,
      }
      this.pending.add(entry)
      options.signal?.addEventListener('abort', abort, { once: true })
      this.loop.start()
    })
  }

  close(): void {
    this.closed = true
    this.loop.stop()
    clearInterval(this.sweep)
    for (const entry of [...this.pending]) {
      entry.cleanup()
      entry.reject(new Error('Transaction confirmer closed'))
    }
  }

  private async tick(signal: AbortSignal): Promise<void> {
    const entries = [...this.pending]
    if (entries.length === 0) return
    // Status batches and the height lookup fail independently. One failed
    // batch must not abandon the others, and a failed height lookup must not
    // discard the confirmations a status already settled. The first failure is
    // rethrown at the end so the polling loop still records it and backs off.
    let failure: unknown
    const withoutStatus: Confirmation[] = []
    for (let offset = 0; offset < entries.length; offset += 256) {
      const batch = entries.slice(offset, offset + 256)
      let statuses
      try {
        ;({ value: statuses } = await boundedRpc(
          () =>
            this.connection.getSignatureStatuses(
              batch.map((entry) => entry.signature),
              { searchTransactionHistory: true }
            ),
          signal,
          this.rpcTimeoutMs
        ))
      } catch (error) {
        if (signal.aborted) throw signal.reason
        failure ??= error
        continue
      }
      for (let i = 0; i < batch.length; i++) {
        const entry = batch[i]
        if (!this.pending.has(entry)) continue
        const status = statuses[i]
        if (status?.err) {
          entry.cleanup()
          entry.reject(
            new Error(`Transaction failed: ${JSON.stringify(status.err)}`)
          )
          continue
        }
        if (
          status?.confirmationStatus === 'confirmed' ||
          status?.confirmationStatus === 'finalized'
        ) {
          entry.cleanup()
          entry.resolve(entry.signature)
          continue
        }
        // A processed transaction can still reach confirmation after its
        // blockhash expires. Expiry applies only when no status is visible.
        if (!status) withoutStatus.push(entry)
      }
    }
    if (signal.aborted) throw signal.reason
    if (withoutStatus.length > 0) {
      try {
        const height = await boundedRpc(
          () => this.connection.getBlockHeight('confirmed'),
          signal,
          this.rpcTimeoutMs
        )
        for (const entry of withoutStatus) {
          if (!this.pending.has(entry)) continue
          if (height > entry.lastValidBlockHeight) {
            entry.cleanup()
            entry.reject(
              new TransactionExpiredBlockheightExceededError(entry.signature)
            )
          }
        }
      } catch (error) {
        // Expiry checks resume next tick; the sweep still enforces timeoutMs.
        if (signal.aborted) throw signal.reason
        failure ??= error
      }
    }
    if (failure) throw failure
  }
}
