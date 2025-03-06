import { type NajPublicKey } from '@types'

export const ENVS = {
  TESTNET_DEV: 'TESTNET_DEV',
  TESTNET: 'TESTNET',
  MAINNET: 'MAINNET',
} as const

export const CHAINS = {
  ETHEREUM: 'ETHEREUM',
  NEAR: 'NEAR',
} as const

/**
 * Root public keys for the Sig Network Smart Contracts across different environments.
 *
 * These keys should never change.
 */
export const ROOT_PUBLIC_KEYS: Record<keyof typeof ENVS, NajPublicKey> = {
  [ENVS.TESTNET_DEV]:
    'secp256k1:54hU5wcCmVUPFWLDALXMh1fFToZsVXrx9BbTbHzSfQq1Kd1rJZi52iPa4QQxo6s5TgjWqgpY8HamYuUDzG6fAaUq',
  [ENVS.TESTNET]:
    'secp256k1:3Ww8iFjqTHufye5aRGUvrQqETegR4gVUcW8FX5xzscaN9ENhpkffojsxJwi6N1RbbHMTxYa9UyKeqK3fsMuwxjR5',
  [ENVS.MAINNET]:
    'secp256k1:4tY4qMzusmgX5wYdG35663Y3Qar3CTbpApotwk9ZKLoF79XA4DjG8XoByaKdNHKQX9Lz5hd7iJqsWdTKyA7dKa6Z',
}

/**
 * Chain IDs used in the key derivation function (KDF) for deriving child public keys to
 * distinguish between different chains.
 *
 * @see {@link deriveChildPublicKey} in cryptography.ts for usage details
 */
export const KDF_CHAIN_IDS = {
  [CHAINS.ETHEREUM]: '0x1',
  [CHAINS.NEAR]: '0x18d',
} as const

/**
 * Contract addresses for different chains and environments.
 *
 * - Testnet Dev: Used for internal development, very unstable
 * - Testnet: Used for external development, stable
 * - Mainnet: Production contract address
 *
 * @see ChainSignatureContract documentation for implementation details
 */
export const CONTRACT_ADDRESSES: Record<
  keyof typeof CHAINS,
  Record<keyof typeof ENVS, string>
> = {
  [CHAINS.NEAR]: {
    [ENVS.TESTNET_DEV]: 'dev.sig-net.testnet',
    [ENVS.TESTNET]: 'v1.sig-net.testnet',
    [ENVS.MAINNET]: 'v1.sig-net.near',
  },
  [CHAINS.ETHEREUM]: {
    [ENVS.TESTNET_DEV]: '0x69C6b28Fdc74618817fa380De29a653060e14009',
    [ENVS.TESTNET]: '0x83458E8Bf8206131Fe5c05127007FA164c0948A2',
    [ENVS.MAINNET]: '0xf8bdC0612361a1E49a8E01423d4C0cFc5dF4791A',
  },
}
