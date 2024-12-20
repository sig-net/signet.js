import { type MPCSignature, type RSVSignature } from './types'

export const toRSV = (signature: MPCSignature): RSVSignature => {
  return {
    r: signature.big_r.affine_point.substring(2),
    s: signature.s.scalar,
    v: signature.recovery_id,
  }
}
