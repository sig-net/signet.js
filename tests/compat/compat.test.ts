import { execSync } from 'child_process'
import { mkdtempSync, writeFileSync, rmSync, readdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const pkgDir = join(__dirname, '..', '..')

describe('CJS/ESM compatibility', () => {
  describe('Layer 1: attw (type resolution)', () => {
    it('passes all module resolution modes', () => {
      const result = execSync('pnpm exec attw --pack .', {
        cwd: pkgDir,
        encoding: 'utf-8',
      })
      expect(result).toContain('No problems found')
    })
  })

  describe('Layer 2: publint (package.json & format)', () => {
    it('passes strict lint', () => {
      execSync('pnpm exec publint --strict', {
        cwd: pkgDir,
        encoding: 'utf-8',
      })
    })
  })

  describe('Layer 3: Runtime smoke tests', () => {
    let tmp: string
    let tarball: string

    beforeAll(async () => {
      execSync('pnpm pack', { cwd: pkgDir, stdio: 'ignore' })
      const tgz = readdirSync(pkgDir).find((f) => f.endsWith('.tgz'))
      if (!tgz) throw new Error('pnpm pack did not produce a .tgz file')
      tarball = tgz
      tmp = mkdtempSync(join(tmpdir(), 'signet-compat-'))
      execSync('npm init -y', { cwd: tmp, stdio: 'ignore' })
      execSync(`npm install ${join(pkgDir, tarball)}`, {
        cwd: tmp,
        stdio: 'ignore',
      })
    }, 60_000)

    afterAll(() => {
      rmSync(tmp, { recursive: true, force: true })
      rmSync(join(pkgDir, tarball), { force: true })
    })

    it('can be required via CJS', () => {
      const script = join(tmp, 'test-cjs.cjs')
      writeFileSync(
        script,
        `
const pkg = require('signet.js');
const assert = require('assert');
assert(pkg.chainAdapters, 'missing chainAdapters');
assert(pkg.constants, 'missing constants');
assert(pkg.utils, 'missing utils');
assert(pkg.contracts, 'missing contracts');
console.log('CJS OK');
`
      )
      const result = execSync(`node ${script}`, { encoding: 'utf-8' })
      expect(result.trim()).toBe('CJS OK')
    })

    it('can be imported via ESM', () => {
      const script = join(tmp, 'test-esm.mjs')
      writeFileSync(
        script,
        `
import * as pkg from 'signet.js';
import assert from 'assert';
assert(pkg.chainAdapters, 'missing chainAdapters');
assert(pkg.constants, 'missing constants');
assert(pkg.utils, 'missing utils');
assert(pkg.contracts, 'missing contracts');
console.log('ESM OK');
`
      )
      const result = execSync(`node ${script}`, { encoding: 'utf-8' })
      expect(result.trim()).toBe('ESM OK')
    })
  })
})
