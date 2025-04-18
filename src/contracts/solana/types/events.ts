import { PublicKey } from '@solana/web3.js';

interface AffinePoint {
  x: number[];
  y: number[];
}

interface Signature {
  bigR: AffinePoint;
  s: number[];
  recoveryId: number;
}

export interface SignatureRespondedEvent {
  requestId: number[];
  responder: PublicKey;
  signature: Signature;
}

export interface SignatureErrorEvent {
  requestId: number[];
  responder: PublicKey;
  error: string;
}