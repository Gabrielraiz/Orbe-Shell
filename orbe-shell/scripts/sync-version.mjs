import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = fileURLToPath(new URL('../', import.meta.url))
const readUtf8 = (path) => readFileSync(path, 'utf8').replace(/^\uFEFF/, '')

// Keep the four-part display version in apps.js. Numeric SemVer metadata also
// gives Tauri the correct fourth component in Windows executable resources.
export function syncVersion(root = appRoot, { check = false } = {}) {
  const apps = readUtf8(resolve(root, 'src/lib/apps.js'))
  const match = apps.match(/^export const VERSION = '(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?'\r?$/m)
  if (!match) throw new Error("src/lib/apps.js deve declarar VERSION = 'X.Y.Z[.N]'.")
  const parts = match.slice(1).filter((part) => part !== undefined)
  if (parts.some((part) => !/^(0|[1-9]\d*)$/.test(part))) {
    throw new Error('Os componentes de VERSION nao podem ter zeros a esquerda.')
  }
  // MSI and Windows version resources have fixed-size numeric fields.
  if (parts.some((part, index) => Number(part) > (index < 2 ? 255 : 65535))) {
    throw new Error('VERSION excede os limites dos instaladores Windows (255.255.65535.65535).')
  }
  const displayVersion = parts.join('.')
  const baseVersion = parts.slice(0, 3).join('.')
  const manifestVersion = parts.length === 4 ? `${baseVersion}+${parts[3]}` : baseVersion
  const updates = new Map()

  for (const relative of ['package.json', 'src-tauri/tauri.conf.json', 'package-lock.json']) {
    const path = resolve(root, relative)
    const json = JSON.parse(readUtf8(path))
    json.version = manifestVersion
    if (relative === 'package-lock.json') json.packages[''].version = manifestVersion
    updates.set(path, `${JSON.stringify(json, null, 2)}\n`)
  }

  const cargoPath = resolve(root, 'src-tauri/Cargo.toml')
  const cargo = readUtf8(cargoPath)
  const packageSection = /(^\[package\][^\S\r\n]*\r?\n)([\s\S]*?)(?=^\[|(?![\s\S]))/m
  const section = cargo.match(packageSection)
  if (!section || !/^version\s*=\s*"[^"]+"/m.test(section[2])) {
    throw new Error('Cargo.toml deve ter version na secao [package].')
  }
  const updatedSection = section[2].replace(/^version\s*=\s*"[^"]+"/m, () => `version = "${manifestVersion}"`)
  updates.set(cargoPath, cargo.replace(packageSection, () => section[1] + updatedSection))

  // Parse and prepare every file before writing anything, so invalid input
  // cannot leave only some manifests synchronized.
  const normalizeNewlines = (text) => text.replace(/\r\n/g, '\n')
  const changed = [...updates].filter(([path, next]) => normalizeNewlines(readFileSync(path, 'utf8')) !== normalizeNewlines(next))
  if (check && changed.length) {
    throw new Error(`Versoes divergentes; execute npm run version:sync: ${changed.map(([path]) => path).join(', ')}`)
  }
  if (!check) for (const [path, next] of changed) writeFileSync(path, next, 'utf8')
  return { displayVersion, manifestVersion, changed: changed.map(([path]) => path) }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = syncVersion(appRoot, { check: process.argv.includes('--check') })
    console.log(`Versao completa (UI): ${result.displayVersion} | SemVer (manifestos): ${result.manifestVersion}`)
    for (const path of result.changed) console.log(`  Sincronizado: ${path}`)
    console.log('[OK] Versoes sincronizadas (UI X.Y.Z.N; manifestos X.Y.Z+N).')
  } catch (error) {
    console.error(`[FALHA] Sincronizacao de versao: ${error.message}`)
    process.exitCode = 1
  }
}
