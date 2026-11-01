import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const script = readFileSync(new URL('../scripts/dev.ps1', import.meta.url), 'utf8')
const functions = script.slice(script.indexOf('function Log('), script.indexOf('Log "Orbe Shell - Diagnostico iniciado'))
const psQuote = (text) => `'${text.replace(/'/g, "''")}'`

for (const shell of ['powershell.exe', 'pwsh.exe']) {
  test(`${shell}: captura stderr completo e preserva codigos de saida`, { skip: process.platform !== 'win32' }, (t) => {
    const root = mkdtempSync(join(tmpdir(), 'orbe-diagnostic-'))
    t.after(() => rmSync(root, { recursive: true, force: true }))
    const child = join(root, 'child.cjs')
    writeFileSync(child, "console.error('warning: first line'); console.error('error: second line'); console.log('last line'); process.exit(Number(process.argv[2]))")
    const harness = join(root, 'test.ps1')
    writeFileSync(harness, `
$script:Report = New-Object System.Collections.Generic.List[string]
$script:Failures = 0
$script:Warnings = 0
${functions}
$LASTEXITCODE = 9
$first = Run-Step 'stderr with success' ${psQuote(process.execPath)} @(${psQuote(child)}, '0')
if ($first -ne 0) { throw 'stderr incorrectly changed a successful exit code' }
$second = Run-Step 'stderr with failure' ${psQuote(process.execPath)} @(${psQuote(child)}, '7')
if ($second -ne 7) { throw 'nonzero exit code was lost' }
$missing = Run-Step 'missing executable' 'orbe-command-that-does-not-exist' @()
if ($missing -eq 0 -or $script:Failures -ne 2) { throw 'missing command did not fail' }
if (($script:Report -join "\n") -notmatch 'last line') { throw 'output was truncated at stderr' }
exit 0
`, 'utf8')
    const result = spawnSync(shell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', harness], {
      encoding: 'utf8', windowsHide: true, timeout: 30000,
    })
    if (result.error?.code === 'ENOENT') return t.skip(`${shell} nao instalado`)
    assert.equal(result.status, 0, result.stdout + result.stderr)
    assert.ok(result.stdout.includes('warning: first line'))
    assert.ok(result.stdout.includes('error: second line'))
    assert.ok(result.stdout.includes('last line'))
  })
}
