import { readFileSync } from 'fs'
import { resolve } from 'path'

import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
) as {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

// Get all dependencies and devDependencies
const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
]

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external,
    },
    target: 'node16',
    sourcemap: true,
  },
  plugins: [
    dts({
      tsconfigPath: './tsconfig.json',
    }),
  ],
  resolve: {
    alias: {
      '@chains': resolve(__dirname, './src/chains'),
      '@utils': resolve(__dirname, './src/utils'),
    },
    mainFields: ['module', 'main'],
    conditions: ['node'],
    preserveSymlinks: true,
  },
})
