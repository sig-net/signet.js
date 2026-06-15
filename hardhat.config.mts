import { defineConfig } from 'hardhat/config'

export default defineConfig({
  networks: {
    hardhat: {
      type: 'edr-simulated',
      chainType: 'l1',
      chainId: 31337,
    },
  },
})
