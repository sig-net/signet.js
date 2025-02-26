import { resolve } from 'path'

import { defineConfig } from 'tsup'
import type { Options } from 'tsup'

export default defineConfig((options) => {
  const isNode = options.env?.TARGET === 'node'
  const isBrowser = options.env?.TARGET === 'browser'

  if (!isNode && !isBrowser) {
    throw new Error(
      'TARGET environment variable must be set to either "node" or "browser"'
    )
  }

  const target = isNode ? 'node18' : 'esnext'
  const platform = isNode ? 'node' : 'browser'
  const outDir = `dist/${platform}`

  const config: Options = {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    target,
    platform,
    outDir,
    outExtension({ format }) {
      return {
        js: format === 'esm' ? `.${platform}.js` : `.${platform}.cjs`,
      }
    },
    sourcemap: true,
    minify: true,
    clean: false, // Don't clean the dist folder on each build
    dts: isNode,
    external: isNode
      ? ['path', 'fs', 'crypto', 'stream', 'util', 'events', 'buffer']
      : ['crypto', 'stream', 'util', 'events', 'buffer'],
    treeshake: true,
    splitting: false,
    esbuildOptions(options) {
      options.conditions = isNode
        ? ['node', 'import', 'default']
        : ['browser', 'import', 'default']
      options.mainFields = isNode
        ? ['module', 'main']
        : ['browser', 'module', 'main']
      options.alias = {
        '@chains': resolve(__dirname, './src/chains'),
        '@utils': resolve(__dirname, './src/utils'),
      }
    },
  }

  return config
})
