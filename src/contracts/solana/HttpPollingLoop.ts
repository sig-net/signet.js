/** Runs bounded HTTP work with a single supervised timer and retry backoff. */
export class HttpPollingLoop {
  private controller?: AbortController
  private timer?: ReturnType<typeof setTimeout>
  private failures = 0
  lastSuccessAt?: number
  lastError?: string
  restarts = 0

  constructor(
    private readonly tick: (signal: AbortSignal) => Promise<void>,
    private readonly intervalMs: number,
    private readonly maxBackoffMs = 30_000
  ) {
    if (!(intervalMs > 0) || !(maxBackoffMs >= intervalMs)) {
      throw new Error('Invalid polling interval/backoff')
    }
  }

  get running(): boolean {
    return this.controller !== undefined
  }

  start(): void {
    if (this.controller) return
    const controller = new AbortController()
    this.controller = controller
    const run = async (): Promise<void> => {
      let delay = this.intervalMs
      try {
        await this.tick(controller.signal)
        if (controller.signal.aborted) return
        this.failures = 0
        this.lastError = undefined
        this.lastSuccessAt = Date.now()
      } catch (error) {
        if (controller.signal.aborted) return
        this.lastError = error instanceof Error ? error.message : String(error)
        this.failures++
        delay = Math.min(
          this.maxBackoffMs,
          this.intervalMs * 2 ** Math.min(this.failures, 10)
        )
        delay *= 0.8 + Math.random() * 0.2
      }
      if (!controller.signal.aborted)
        this.timer = setTimeout(() => {
          void run()
        }, delay)
    }
    void run()
  }

  stop(): void {
    this.controller?.abort(new Error('Polling loop stopped'))
    this.controller = undefined
    clearTimeout(this.timer)
  }

  restart(): void {
    this.stop()
    this.restarts++
    this.start()
  }
}

/** Late RPC completions cannot mutate a stopped or restarted polling loop. */
export async function boundedRpc<T>(
  operation: () => Promise<T>,
  signal: AbortSignal,
  timeoutMs: number
): Promise<T> {
  if (signal.aborted) throw signal.reason
  return await new Promise<T>((resolve, reject) => {
    const onAbort = (): void => {
      cleanup()
      reject(signal.reason)
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`HTTP RPC exceeded ${timeoutMs}ms`))
    }, timeoutMs)
    const cleanup = (): void => {
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
    }
    signal.addEventListener('abort', onAbort, { once: true })
    Promise.resolve()
      .then(operation)
      .then(
        (value) => {
          cleanup()
          resolve(value)
        },
        (error) => {
          cleanup()
          reject(error)
        }
      )
  })
}
