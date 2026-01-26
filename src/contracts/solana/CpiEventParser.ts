import * as anchor from '@coral-xyz/anchor'
import {
  type Connection,
  type ParsedTransactionWithMeta,
} from '@solana/web3.js'

import type { ChainSignaturesEvent } from './types/events'

// Anchor's emit_cpi! instruction discriminator: Sha256("anchor:event")[..8]
const EMIT_CPI_INSTRUCTION_DISCRIMINATOR = Buffer.from([
  0xe4, 0x45, 0xa5, 0x2e, 0x51, 0xcb, 0x9a, 0x1d,
])

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class CpiEventParser {
  /**
   * Parse CPI events from an already-fetched transaction (emit_cpi! pattern).
   */
  static parseCpiEventsFromTransaction<T extends anchor.Idl>(
    tx: ParsedTransactionWithMeta | null,
    targetProgramId: string,
    program: anchor.Program<T>
  ): ChainSignaturesEvent[] {
    const events: ChainSignaturesEvent[] = []
    if (!tx?.meta?.innerInstructions) return events

    for (const innerIxSet of tx.meta.innerInstructions) {
      for (const instruction of innerIxSet.instructions) {
        if (!('programId' in instruction) || !('data' in instruction)) continue
        if (instruction.programId.toString() !== targetProgramId) continue

        const parsedEvent = this.parseInstruction(instruction.data, program)
        if (parsedEvent) events.push(parsedEvent)
      }
    }

    return events
  }

  /**
   * Fetch a transaction by signature and parse its CPI events.
   * Used by the subscription path where only the signature is available.
   */
  static async fetchAndParseCpiEvents<T extends anchor.Idl>(
    connection: Connection,
    signature: string,
    targetProgramId: string,
    program: anchor.Program<T>
  ): Promise<ChainSignaturesEvent[]> {
    try {
      const tx = await connection.getParsedTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      })
      return this.parseCpiEventsFromTransaction(tx, targetProgramId, program)
    } catch {
      return []
    }
  }

  /**
   * Parse CPI event from instruction data
   * Structure: [8 bytes: anchor discriminator][8 bytes: event discriminator][event data]
   */
  private static parseInstruction<T extends anchor.Idl>(
    instructionData: string,
    program: anchor.Program<T>
  ): ChainSignaturesEvent | null {
    try {
      const ixData = anchor.utils.bytes.bs58.decode(instructionData)

      if (ixData.length < 16) {
        return null
      }

      const ixDiscriminator = ixData.subarray(0, 8)
      if (
        Buffer.compare(ixDiscriminator, EMIT_CPI_INSTRUCTION_DISCRIMINATOR) !==
        0
      ) {
        return null
      }

      const eventDiscriminator = ixData.subarray(8, 16)

      const matchedEvent = program.idl.events?.find((event) => {
        const idlDiscriminator = Buffer.from(event.discriminator)
        return Buffer.compare(eventDiscriminator, idlDiscriminator) === 0
      })

      if (!matchedEvent) {
        return null
      }

      const fullEventData = ixData.subarray(8)

      const decodedEvent = program.coder.events.decode(
        anchor.utils.bytes.base64.encode(fullEventData)
      )

      return decodedEvent as ChainSignaturesEvent | null
    } catch {
      return null
    }
  }

  /**
   * Subscribe to CPI events for a program
   */
  static subscribeToCpiEvents<T extends anchor.Idl>(
    connection: Connection,
    program: anchor.Program<T>,
    eventHandlers: Map<
      ChainSignaturesEvent['name'],
      (event: ChainSignaturesEvent['data'], slot: number) => Promise<void>
    >
  ): number {
    return connection.onLogs(
      program.programId,
      (logs, context) => {
        if (logs.err) return

        void (async () => {
          const events = await this.fetchAndParseCpiEvents(
            connection,
            logs.signature,
            program.programId.toString(),
            program
          )

          for (const event of events) {
            const handler = eventHandlers.get(event.name)
            if (handler) {
              try {
                await handler(event.data, context.slot)
              } catch {}
            }
          }
        })()
      },
      'confirmed'
    )
  }
}
