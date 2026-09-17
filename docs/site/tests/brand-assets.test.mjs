import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { BRAND_ICON_PATH, prepareBrandAssets } from '../.vitepress/brand.mjs'

const sourceDir = new URL('../../../build/icon-source/', import.meta.url)
const appIcon = Buffer.from(readdirSync(sourceDir).filter(name => name.endsWith('.b64')).sort()
  .map(name => readFileSync(new URL(name, sourceDir), 'utf8').trim()).join(''), 'base64')

function temporaryDirectory(t) {
  const directory = mkdtempSync(join(tmpdir(), 'free-rider-brand-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  return directory
}

test('documentation uses the exact transparent app icon, without re-encoding', t => {
  const publicDir = temporaryDirectory(t)
  prepareBrandAssets({ publicDir })
  const icon = readFileSync(join(publicDir, BRAND_ICON_PATH.slice(1)))
  assert.deepEqual(icon, appIcon)
  assert.equal(icon.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  assert.equal(icon.readUInt32BE(16), 512)
  assert.equal(icon.readUInt32BE(20), 512)
  assert.ok(icon.includes(Buffer.from('tRNS')), 'PNG transparency is preserved')
})

test('repeated preparation remains byte-identical', t => {
  const publicDir = temporaryDirectory(t)
  prepareBrandAssets({ publicDir })
  prepareBrandAssets({ publicDir })
  assert.deepEqual(readFileSync(join(publicDir, BRAND_ICON_PATH.slice(1))), appIcon)
})

test('missing icon chunks fail instead of silently shipping a broken image', t => {
  const emptyDir = temporaryDirectory(t)
  const publicDir = temporaryDirectory(t)
  assert.throws(() => prepareBrandAssets({ sourceDir: emptyDir, publicDir }), /No app icon chunks/)
  assert.deepEqual(readdirSync(publicDir), [])
})

test('invalid base64 fails before writing a public asset', t => {
  const sourceDir = temporaryDirectory(t)
  const publicDir = temporaryDirectory(t)
  writeFileSync(join(sourceDir, '00.b64'), 'not-valid-base64!')
  assert.throws(() => prepareBrandAssets({ sourceDir, publicDir }), /Invalid app icon base64/)
  assert.deepEqual(readdirSync(publicDir), [])
})

test('non-PNG input fails before writing a public asset', t => {
  const sourceDir = temporaryDirectory(t)
  const publicDir = temporaryDirectory(t)
  writeFileSync(join(sourceDir, '00.b64'), Buffer.from('not a PNG').toString('base64'))
  assert.throws(() => prepareBrandAssets({ sourceDir, publicDir }), /not a PNG/)
  assert.deepEqual(readdirSync(publicDir), [])
})
