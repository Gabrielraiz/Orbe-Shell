import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { syncVersion } from '../scripts/sync-version.mjs'

function fixture(t, version = '1.1.0.5') {
  const root = mkdtempSync(join(tmpdir(), 'orbe-version-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'src/lib'), { recursive: true })
  mkdirSync(join(root, 'src-tauri'))
  writeFileSync(join(root, 'src/lib/apps.js'), `export const VERSION = '${version}'\n`)
  writeFileSync(join(root, 'package.json'), '\uFEFF{"version":"0.0.0","description":"Experiência"}')
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify({
    version: '0.0.0', packages: { '': { version: '0.0.0' }, dependency: { version: '0.58' } },
  }))
  writeFileSync(join(root, 'src-tauri/tauri.conf.json'), '{"version":"0.0.0","productName":"Orbe Shell"}')
  writeFileSync(join(root, 'src-tauri/Cargo.toml'), '\uFEFF[package]\r\nname = "orbe-shell"\r\nversion = "0.0.0"\r\ndescription = "Experiência"\r\n\r\n[target.\'cfg(windows)\'.dependencies.windows]\r\nversion = "0.58"\r\n')
  return root
}

test('sincroniza somente a versao do aplicativo, preserva UTF-8 e dependencias', (t) => {
  const root = fixture(t)
  const result = syncVersion(root)
  assert.equal(result.displayVersion, '1.1.0.5')
  assert.equal(result.manifestVersion, '1.1.0+5')
  assert.equal(result.changed.length, 4)
  const pkgText = readFileSync(join(root, 'package.json'), 'utf8')
  assert.equal(JSON.parse(pkgText).description, 'Experiência')
  assert.equal(JSON.parse(pkgText).version, '1.1.0+5')
  const cargo = readFileSync(join(root, 'src-tauri/Cargo.toml'), 'utf8')
  assert.match(cargo, /\[package\]\r\nname = "orbe-shell"\r\nversion = "1\.1\.0\+5"/)
  assert.match(cargo, /dependencies.windows\]\r\nversion = "0\.58"/)
  assert.ok(cargo.includes('Experiência'))
  for (const path of result.changed) assert.notEqual(readFileSync(path, 'utf8').charCodeAt(0), 0xFEFF)
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'))
  assert.equal(lock.version, '1.1.0+5')
  assert.equal(lock.packages[''].version, '1.1.0+5')
  assert.equal(lock.packages.dependency.version, '0.58')
  assert.deepEqual(syncVersion(root).changed, [])
  assert.deepEqual(syncVersion(root, { check: true }).changed, [])
})

test('checagem detecta divergencias sem modificar arquivos', (t) => {
  const root = fixture(t)
  const before = readFileSync(join(root, 'package.json'), 'utf8')
  assert.throws(() => syncVersion(root, { check: true }), /Versoes divergentes/)
  assert.equal(readFileSync(join(root, 'package.json'), 'utf8'), before)
})

test('JSON invalido nao deixa manifestos parcialmente atualizados', (t) => {
  const root = fixture(t)
  const before = readFileSync(join(root, 'package.json'), 'utf8')
  writeFileSync(join(root, 'src-tauri/tauri.conf.json'), '{ $11.1.0" }')
  assert.throws(() => syncVersion(root), SyntaxError)
  assert.equal(readFileSync(join(root, 'package.json'), 'utf8'), before)
})

test('rejeita versoes invalidas antes de gravar', (t) => {
  for (const version of ['False', '1.01.0.5', '1.1.0.65536', '256.1.0.5', '1.1.0.5.6']) {
    const root = fixture(t, version)
    const before = readFileSync(join(root, 'package.json'), 'utf8')
    assert.throws(() => syncVersion(root))
    assert.equal(readFileSync(join(root, 'package.json'), 'utf8'), before)
  }
})

test('aceita versao sem revisao', (t) => {
  const root = fixture(t, '2.0.0')
  assert.equal(syncVersion(root).manifestVersion, '2.0.0')
})

test('aceita checkout Windows CRLF sem reportar divergencias', (t) => {
  const root = fixture(t)
  syncVersion(root)
  for (const relative of ['src/lib/apps.js', 'package.json', 'package-lock.json', 'src-tauri/tauri.conf.json', 'src-tauri/Cargo.toml']) {
    const path = join(root, relative)
    writeFileSync(path, readFileSync(path, 'utf8').replace(/\r?\n/g, '\r\n'))
  }
  assert.deepEqual(syncVersion(root, { check: true }).changed, [])
})
