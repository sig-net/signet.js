import { execSync } from 'child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { describe, it, expect, beforeAll } from 'vitest'

const pkgDir = join(__dirname, '..', '..')

describe('CJS/ESM runtime compatibility', () => {
  let tmp: string
  let tarball: string

  beforeAll(() => {
    const packOut = execSync('pnpm pack --pack-destination /tmp', {
      cwd: pkgDir,
      encoding: 'utf-8',
    }).trim()
    tarball = packOut.split('\n').pop()!

    tmp = mkdtempSync(join(tmpdir(), 'signet-compat-'))
    execSync('npm init -y', { cwd: tmp, stdio: 'ignore' })
    execSync(`npm install ${tarball}`, { cwd: tmp, stdio: 'ignore' })

    return () => {
      rmSync(tmp, { recursive: true, force: true })
      rmSync(tarball, { force: true })
    }
  }, 60_000)

  it('can be required via CJS', () => {
    const script = join(tmp, 'test-cjs.cjs')
    writeFileSync(
      script,
      `
const assert = require('assert');
const pkg = require('signet.js');

assert(typeof pkg.chainAdapters.ChainAdapter === 'function', 'chainAdapters.ChainAdapter should be a function');
assert(typeof pkg.constants.ENVS === 'object', 'constants.ENVS should be an object');
assert(typeof pkg.utils.cryptography === 'object', 'utils.cryptography should be an object');
assert(typeof pkg.contracts.ChainSignatureContract === 'function', 'contracts.ChainSignatureContract should be a function');
console.log('CJS OK');
`
    )
    const result = execSync(`node ${script}`, { encoding: 'utf-8' })
    expect(result.trim()).toBe('CJS OK')
  })

  it('can be imported via ESM (namespace)', () => {
    const script = join(tmp, 'test-esm.mjs')
    writeFileSync(
      script,
      `
import assert from 'assert';
import * as pkg from 'signet.js';

assert(typeof pkg.chainAdapters.ChainAdapter === 'function', 'chainAdapters.ChainAdapter should be a function');
assert(typeof pkg.constants.ENVS === 'object', 'constants.ENVS should be an object');
assert(typeof pkg.utils.cryptography === 'object', 'utils.cryptography should be an object');
assert(typeof pkg.contracts.ChainSignatureContract === 'function', 'contracts.ChainSignatureContract should be a function');
console.log('ESM OK');
`
    )
    const result = execSync(`node ${script}`, { encoding: 'utf-8' })
    expect(result.trim()).toBe('ESM OK')
  })

  it('can be imported via ESM (named imports)', () => {
    const script = join(tmp, 'test-esm-named.mjs')
    writeFileSync(
      script,
      `
import assert from 'assert';
import { chainAdapters, constants, utils, contracts } from 'signet.js';

assert(typeof chainAdapters.ChainAdapter === 'function', 'chainAdapters.ChainAdapter should be a function');
assert(typeof constants.ENVS === 'object', 'constants.ENVS should be an object');
assert(typeof utils.cryptography === 'object', 'utils.cryptography should be an object');
assert(typeof contracts.ChainSignatureContract === 'function', 'contracts.ChainSignatureContract should be a function');
console.log('ESM Named OK');
`
    )
    const result = execSync(`node ${script}`, { encoding: 'utf-8' })
    expect(result.trim()).toBe('ESM Named OK')
  })
})
