import * as anchor from '@coral-xyz/anchor'
import { type Connection } from '@solana/web3.js'

import type { ChainSignaturesEvent } from './types/events'

// EMIT_CPI_INSTRUCTION_DISCRIMINATOR - identifies that this is an emit_cpi! instruction
// This is a constant from Anchor that identifies the instruction type
// Value: e445a52e51cb9a1d
const EMIT_CPI_INSTRUCTION_DISCRIMINATOR = Buffer.from([
  0xe4, 0x45, 0xa5, 0x2e, 0x51, 0xcb, 0x9a, 0x1d,
])

export type ParsedCpiEvent = ChainSignaturesEvent

/**
 * Parse CPI events from a transaction
 */
async function parseCpiEvents<T extends anchor.Idl>(
  connection: Connection,
  signature: string,
  targetProgramId: string,
  program: anchor.Program<T>
): Promise<ParsedCpiEvent[]> {
  const events: ParsedCpiEvent[] = []

  try {
    const tx = await connection.getParsedTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    })

    if (!tx?.meta) return events

    const innerInstructions = tx.meta.innerInstructions || []

    for (const innerIxSet of innerInstructions) {
      for (const instruction of innerIxSet.instructions) {
        if (
          'programId' in instruction &&
          'data' in instruction &&
          instruction.programId.toString() === targetProgramId
        ) {
          const parsedEvent = parseInstruction(instruction.data, program)
          if (parsedEvent) {
            events.push(parsedEvent)
          }
        }
      }
    }
  } catch (error) {
    console.error('Error parsing transaction for CPI events:', error)
  }

  return events
}

/**
 * Parse a single instruction for CPI event data
 */
function parseInstruction<T extends anchor.Idl>(
  instructionData: string,
  program: anchor.Program<T>
): ParsedCpiEvent | null {
  try {
    const ixData = anchor.utils.bytes.bs58.decode(instructionData)
    if (
      ixData.length >= 16 &&
      Buffer.compare(
        ixData.subarray(0, 8),
        EMIT_CPI_INSTRUCTION_DISCRIMINATOR
      ) === 0
    ) {
      const eventDiscriminator = ixData.subarray(8, 16)
      const eventData = ixData.subarray(16)

      let matchedEvent: { discriminator: number[] } | null = null
      for (const event of program.idl.events || []) {
        const idlDiscriminator = Buffer.from(event.discriminator)
        if (Buffer.compare(eventDiscriminator, idlDiscriminator) === 0) {
          matchedEvent = event
          break
        }
      }

      if (matchedEvent) {
        try {
          const fullEventData = Buffer.concat([eventDiscriminator, eventData])
          const eventCoder = new anchor.BorshEventCoder(program.idl)
          const decodedEvent = eventCoder.decode(
            fullEventData.toString('base64')
          )
          if (decodedEvent) {
            return decodedEvent as ParsedCpiEvent
          }
        } catch (decodeError) {
          console.log('Failed to decode event data:', decodeError)
        }
      }
    }
  } catch {
    // ignore
  }

  return null
}

/**
 * Subscribe to CPI events for a program
 */
function subscribeToCpiEvents<T extends anchor.Idl>(
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
        const events = await parseCpiEvents(
          connection,
          logs.signature,
          program.programId.toString(),
          program
        )
        for (const event of events) {
          const handler = eventHandlers.get(event.name)
          if (handler) {
            await handler(event.data, context.slot)
          }
        }
      })()
    },
    'confirmed'
  )
}

export const CpiEventParser = {
  parseCpiEvents,
  subscribeToCpiEvents,
} as const
