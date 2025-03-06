import * as bitcoin from 'bitcoinjs-lib'

export function parseBTCNetwork(network: string): bitcoin.networks.Network {
  switch (network.toLowerCase()) {
    case 'mainnet':
      return bitcoin.networks.bitcoin
    case 'testnet':
      return bitcoin.networks.testnet
    case 'regtest':
      return bitcoin.networks.regtest
    default:
      throw new Error(`Unknown Bitcoin network: ${network}`)
  }
}
