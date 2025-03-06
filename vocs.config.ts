import { defineConfig, type Config } from 'vocs'

export default defineConfig({
  title: 'Sig Network',
  description:
    'Manage and use cryptographic key(s) across multiple chains or multiple contexts, with on-chain-enforced conditions',
  twoslash: {
    compilerOptions: {
      strict: true,
      paths: {
        'signet.js': ['./src'],
        '@chain-adapters': ['./src/chain-adapters/index.ts'],
        '@contracts': ['./src/contracts/index.ts'],
        '@utils': ['./src/utils/index.ts'],
        '@constants': ['./src/constants.ts'],
        '@types': ['./src/types.ts'],
        '@chain-adapters/*': ['./src/chain-adapters/*'],
        '@contracts/*': ['./src/contracts/*'],
        '@utils/*': ['./src/utils/*'],
      },
    },
  },
  logoUrl: 'signet-logo.png',
  iconUrl: 'signet-logo.png',
  sidebar: [
    {
      text: 'Introduction',
      items: [
        { text: 'Introduction to Chain Signatures', link: '/' },
        {
          text: 'Signet.js Quickstart',
          link: '/introduction/signet-quick-start',
        },
      ],
    },
    {
      text: 'Primitives',
      items: [
        { text: 'Contract Addresses', link: '/primitives/contract-addresses' },
        {
          text: 'Chain Adapter Interface',
          link: '/primitives/chain-adapter-interface',
        },
        {
          text: 'Chain Contract Interfaces',
          link: '/primitives/chain-contract-interfaces',
        },
      ],
    },
    {
      text: 'Examples',
      items: [
        { text: 'Signing an arbitrary hash', link: '/examples/arbitrary-hash' },
        {
          text: 'Use Ethereum chain signatures to securely sponsor gas fees for calling your Base smart contract',
          link: '/examples/sponsor-foreign-chain-gas',
        },
      ],
    },
    {
      text: 'API Reference',
      items: [
        {
          text: 'EVM Chains',
          items: [
            { text: 'Overview', link: '/signetjs/chains/evm' },
            {
              text: 'prepareTransactionForSigning',
              link: '/signetjs/chains/evm/prepare-transaction-for-signing',
            },
            {
              text: 'finalizeTransactionSigning',
              link: '/signetjs/chains/evm/finalize-transaction-signing',
            },
            {
              text: 'prepareMessageForSigning',
              link: '/signetjs/chains/evm/prepare-message-for-signing',
            },
            {
              text: 'finalizeMessageSigning',
              link: '/signetjs/chains/evm/finalize-message-signing',
            },
            {
              text: 'prepareTypedDataForSigning',
              link: '/signetjs/chains/evm/prepare-typed-data-for-signing',
            },
            {
              text: 'finalizeTypedDataSigning',
              link: '/signetjs/chains/evm/finalize-typed-data-signing',
            },
          ],
        },
        {
          text: 'Bitcoin',
          items: [
            { text: 'Overview', link: '/signetjs/chains/bitcoin' },
            {
              text: 'RPC Adapter',
              link: '/signetjs/chains/bitcoin/btc-rpc-adapter',
            },
            {
              text: 'prepareTransactionForSigning',
              link: '/signetjs/chains/bitcoin/prepare-transaction-for-signing',
            },
            {
              text: 'finalizeTransactionSigning',
              link: '/signetjs/chains/bitcoin/finalize-transaction-signing',
            },
          ],
        },
        {
          text: 'Cosmos Chains',
          items: [
            { text: 'Overview', link: '/signetjs/chains/cosmos' },
            {
              text: 'prepareTransactionForSigning',
              link: '/signetjs/chains/cosmos/prepare-transaction-for-signing',
            },
            {
              text: 'finalizeTransactionSigning',
              link: '/signetjs/chains/cosmos/finalize-transaction-signing',
            },
          ],
        },
        {
          text: 'Common Methods',
          items: [
            {
              text: 'deriveAddressAndPublicKey',
              link: '/signetjs/chains/derive-address-and-public-key',
            },
            {
              text: 'getBalance',
              link: '/signetjs/chains/get-balance',
            },
            {
              text: 'broadcastTx',
              link: '/signetjs/chains/broadcast-tx',
            },
          ],
        },
        {
          text: 'Utils',
          items: [
            {
              text: 'EVM Contract',
              items: [
                {
                  text: 'constructor',
                  link: '/signetjs/utils/evm-contract/constructor',
                },
                {
                  text: 'getCurrentSignatureDeposit',
                  link: '/signetjs/utils/evm-contract/get-current-signature-deposit',
                },
                {
                  text: 'getDerivedPublicKey',
                  link: '/signetjs/utils/evm-contract/get-derived-public-key',
                },
                {
                  text: 'getPublicKey',
                  link: '/signetjs/utils/evm-contract/get-public-key',
                },
                {
                  text: 'getLatestKeyVersion',
                  link: '/signetjs/utils/evm-contract/get-latest-key-version',
                },
                { text: 'sign', link: '/signetjs/utils/evm-contract/sign' },
              ],
            },
            {
              text: 'NEAR Contract',
              items: [
                {
                  text: 'constructor',
                  link: '/signetjs/utils/near-contract/constructor',
                },
                {
                  text: 'getCurrentSignatureDeposit',
                  link: '/signetjs/utils/near-contract/get-current-signature-deposit',
                },
                {
                  text: 'getDerivedPublicKey',
                  link: '/signetjs/utils/near-contract/get-derived-public-key',
                },
                {
                  text: 'getPublicKey',
                  link: '/signetjs/utils/near-contract/get-public-key',
                },
                { text: 'sign', link: '/signetjs/utils/near-contract/sign' },
              ],
            },
          ],
        },
      ],
    },
  ],

  socials: [
    {
      icon: 'github',
      link: 'https://github.com/sig-net',
    },
  ],

  theme: {
    accentColor: {
      light: '#00C08B',
      dark: '#00E6A6',
    },
  },
}) as Config
