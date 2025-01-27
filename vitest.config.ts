import { resolve } from 'path'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@chains': resolve(__dirname, './src/chains'),
      '@utils': resolve(__dirname, './src/utils'),
    },
  },
})
