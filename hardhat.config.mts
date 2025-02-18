import '@nomicfoundation/hardhat-toolbox'

const config = {
  solidity: '0.8.24',
  networks: {
    hardhat: {
      mining: {
        auto: true,
        interval: 1000,
      },
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337,
    },
  },
}

export default config
