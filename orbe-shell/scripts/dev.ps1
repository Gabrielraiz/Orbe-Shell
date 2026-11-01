# ============================================================================
#  Orbe Shell - Script de Diagnostico, Verificacao e Build (Windows PowerShell)
#  Uso:
#     .\scripts\dev.ps1              -> verificacao completa (deps + lint + build JS + check Rust)
#     .\scripts\dev.ps1 -Dev         -> tudo acima e depois abre o app em modo desenvolvimento
#     .\scripts\dev.ps1 -Build       -> tudo acima e depois gera o instalador (.exe NSIS)
#     .\scripts\dev.ps1 -Tests       -> roda a bateria de testes unitarios (node --test)
#     .\scripts\dev.ps1 -Full        -> Tests + verificacao completa + build do instalador
#     .\scripts\dev.ps1 -Fix         -> aplica correcoes automaticas de formatacao (cargo fmt)
#
#  Ao final, escreve um relatorio completo em scripts\logs\diagnostico-<timestamp>.log
#  com erros, avisos e instrucoes do que corrigir.
# ============================================================================
param(
    [switch]$Dev,
    [switch]$Build,
    [switch]$Tests,
    [switch]$Full,
    [switch]$Fix
)

# Erros de redirect (2>&1) nunca devem derrubar o diagnostico: capturamos tudo.
$ErrorActionPreference = 'Continue'

$env:MSYS2_ARG_CONV_EXCL = '*'
$env:CARGO_TERM_COLOR = 'never'   # sem ANSI no log -> relatorio limpo e legivel

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$LogDir = Join-Path $PSScriptRoot 'logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir "diagnostico-$Stamp.log"

$script:Report = New-Object System.Collections.Generic.List[string]
$script:Failures = 0
$script:Warnings = 0

function Log($msg)          { Write-Host $msg; $script:Report.Add($msg) }
function Section($title)    { Log ''; Log ('=' * 70); Log "  $title"; Log ('=' * 70) }

function Run-Step {
    param([string]$Name, [string]$Cmd, [string[]]$CmdArgs)
    Section $Name
    Log "> $Cmd $($CmdArgs -join ' ')"
    # Windows PowerShell 5.1 transforma stderr em NativeCommandError. Continue
    # preserva a saida completa; somente o codigo do processo decide o resultado.
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $PSNativeCommandUseErrorActionPreference = $false
    $code = 1
    try {
        $null = Get-Command $Cmd -ErrorAction Stop
        $global:LASTEXITCODE = 0
        $raw = & $Cmd @CmdArgs 2>&1 | ForEach-Object { "$_" }
        $code = $global:LASTEXITCODE
    } catch {
        $raw = @("ERRO AO EXECUTAR '$Cmd': " + $_.Exception.Message)
    } finally {
        $ErrorActionPreference = $prevEAP
    }
    $text = (($raw | Out-String) -replace "`r", '')
    if ($text.Trim()) { Log $text.TrimEnd() }

    # Resultados positivos dos testes e contagens zeradas nao sao falhas.
    $suspicious = $raw | Where-Object {
        $line = "$_"
        ($line -match '(?i)\berrors?\b|\berros?\b|\bwarn(ing)?\b|\baviso\b|\bfail(ed|ure)?\b') -and
        $line -notmatch '^Found 0 warnings and 0 errors\.' -and
        $line -notmatch '^\s*(?:[\u2713\u2714]|ok\s+\d+\s+-|[#\u2139]\s+(?:fail|cancelled)\s+0\b)' -and
        $line -notmatch '^test result: ok\..*; 0 failed;'
    }
    if ($suspicious) {
        Log ''
        Log '--- Linhas relevantes (erros/avisos verdadeiros) ---'
        $suspicious | Select-Object -First 30 | ForEach-Object { Log "  ! $_" }
    }

    if ($code -eq 0) {
        $warningLines = @($suspicious | Where-Object { "$_" -match '(?i)\bwarn(ing)?\b|aviso' })
        $script:Warnings += $warningLines.Count
        Log "[OK] $Name"
    } else {
        Log "[FALHA] $Name terminou com codigo $code."
        $script:Failures++
        Log ''
        Log '--- O que fazer ---'
        switch -Regex ($Name) {
            'npm install'      { Log '  * EJSONPARSE: revise package.json. Para outros erros, confira a saida completa e o requisito Node em package.json.' }
            'Lint'             { Log '  * Corrija os avisos listados acima nos arquivos indicados (formato arquivo:linha).' }
            'Build frontend'   { Log '  * MISSING_EXPORT ou erro de sintaxe: abra o arquivo citado e corrija import/export.' }
            'cargo check'      { Log '  * Erros de compilacao Rust: edite src-tauri conforme as linhas apontadas pelo rustc.' }
            'tauri:build'      { Log '  * Instale as dependencias: Rust (rustup), Visual Studio Build Tools (C++), WebView2.' }
            default            { Log '  * Reveja a saida acima.' }
        }
    }
    return $code
}

Log "Orbe Shell - Diagnostico iniciado em $(Get-Date)"
Log "Diretorio: $Root"

# ---------------------------------------------------------------------------
# 0a) Auto-sync via Node: UTF-8 sem BOM, Cargo restrito a [package].
#     UI: X.Y.Z.N; manifestos: SemVer X.Y.Z+N (inclui a revisao Windows).
#     Nao usar $full/$build: colidem com os switches -Full/-Build.
# ---------------------------------------------------------------------------
Run-Step 'Sincronizacao de versao' 'node' @('scripts/sync-version.mjs') | Out-Null

# ---------------------------------------------------------------------------
# 0b) Ambiente
# ---------------------------------------------------------------------------
Section 'Ambiente'
foreach ($t in @(
    @{ n = 'Node.js';  c = 'node';  a = @('--version') },
    @{ n = 'npm';      c = 'npm';   a = @('--version') },
    @{ n = 'Rust';     c = 'cargo'; a = @('--version') }
)) {
    $cmd = Get-Command $t.c -ErrorAction SilentlyContinue
    if (-not $cmd) {
        Log "[AUSENTE] $($t.n) nao encontrado no PATH."
        $script:Failures++
        if ($t.n -eq 'Rust') { Log '  Instale com: winget install Rustlang.Rustup  (depois reabra o terminal)' }
        else { Log '  Instale Node LTS em https://nodejs.org' }
        continue
    }
    $v = & $t.c @($t.a) 2>&1 | Select-Object -First 1
    Log "[OK] $($t.n): $v"
}

# ---------------------------------------------------------------------------
# 1) Dependencias
# ---------------------------------------------------------------------------
Run-Step 'npm install (dependencias JS)' 'npm' @('install') | Out-Null

# ---------------------------------------------------------------------------
# 2) Fix automatico (opcional)
# ---------------------------------------------------------------------------
if ($Fix) {
    if (Get-Command cargo -ErrorAction SilentlyContinue) {
        Push-Location (Join-Path $Root 'src-tauri')
        Run-Step 'cargo fmt (formatacao Rust)' 'cargo' @('fmt') | Out-Null
        Pop-Location
    }
}

# ---------------------------------------------------------------------------
# 3) Testes unitarios (bateria automatizada)
# ---------------------------------------------------------------------------
if ($Tests -or $Full) {
    Run-Step 'Testes unitarios (npm test)' 'npm' @('test') | Out-Null
}

# ---------------------------------------------------------------------------
# 4) Lint (JS) - erros e avisos bloqueiam a validacao
# ---------------------------------------------------------------------------
Run-Step 'Lint JavaScript (oxlint)' 'npm' @('run', 'lint', '--', '--deny-warnings') | Out-Null

# ---------------------------------------------------------------------------
# 5) Build do frontend - detecta imports quebrados (ex.: MISSING_EXPORT)
# ---------------------------------------------------------------------------
Run-Step 'Build frontend (vite build)' 'npm' @('run', 'build') | Out-Null

# ---------------------------------------------------------------------------
# 6) Backend Rust
# ---------------------------------------------------------------------------
if (Get-Command cargo -ErrorAction SilentlyContinue) {
    Push-Location (Join-Path $Root 'src-tauri')
    Run-Step 'Verificacao Rust (cargo check)' 'cargo' @('check', '--message-format', 'short') | Out-Null
    if ($Tests -or $Full) {
        Run-Step 'Testes Rust (cargo test)' 'cargo' @('test', '--locked') | Out-Null
    }

    # A versao completa usa metadado numerico SemVer (+N), aceito pelo Tauri.
    Section 'Validacao da configuracao Tauri'
    $confRaw = Get-Content (Join-Path $Root 'src-tauri\tauri.conf.json') -Raw -Encoding UTF8
    try {
        $confJson = $confRaw | ConvertFrom-Json
        if ($confJson.version -notmatch '^\d+\.\d+\.\d+(?:\+\d+)?$') {
            Log "[FALHA] tauri.conf.json tem versao '$($confJson.version)' (esperado X.Y.Z[+N])."
            Log '  * Execute node scripts/sync-version.mjs e revise o resultado.'
            $script:Failures++
        } else {
            Log "[OK] tauri.conf.json: versao semver valida ($($confJson.version))."
        }
        if (-not $confJson.identifier) { Log '[FALHA] tauri.conf.json sem identifier.'; $script:Failures++ }
        else { Log "[OK] identifier: $($confJson.identifier)" }
    } catch {
        Log "[FALHA] tauri.conf.json nao e JSON valido: $($_.Exception.Message)"
        $script:Failures++
    }
    Pop-Location
} else {
    Log '[PULADO] cargo nao disponivel - verificacao Rust ignorada neste ambiente.'
}

# ---------------------------------------------------------------------------
# 7) Dev ou Build do instalador
# ---------------------------------------------------------------------------
if ($script:Failures -gt 0 -and ($Dev -or $Build -or $Full)) {
    Log '[PULADO] Inicializacao/build do instalador bloqueado por falhas no diagnostico.'
}
if ($Dev -and $script:Failures -eq 0) {
    Section 'Modo desenvolvimento (Tauri)'
    Log 'Iniciando npm run tauri:dev ... (Ctrl+C para sair)'
    & npm run tauri:dev
}
if (($Build -or $Full) -and $script:Failures -eq 0) {
    Section 'Build do instalador (NSIS)'
    Run-Step 'npm run tauri:build' 'npm' @('run', 'tauri:build') | Out-Null
    $exe = Get-ChildItem (Join-Path $Root 'src-tauri\target\release\bundle') -Recurse -Filter '*.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($exe) { Log "Instalador gerado: $($exe.FullName)" }
}

# ---------------------------------------------------------------------------
# Relatorio final
# ---------------------------------------------------------------------------
Section 'RESUMO'
if ($script:Failures -eq 0 -and $script:Warnings -eq 0) {
    Log 'RESULTADO: PASSOU - nenhum erro, nenhum aviso.'
} elseif ($script:Failures -eq 0) {
    Log "RESULTADO: PASSOU COM $([int]$script:Warnings) AVISO(S) - funcional, mas revise a lista de itens a corrigir."
} else {
    Log "RESULTADO: FALHOU - $([int]$script:Failures) etapa(s) com erro. Detalhe acima e no log."
}
Log "Relatorio salvo em: $LogFile"
$script:Report -join "`r`n" | Set-Content -Path $LogFile -Encoding UTF8

exit ([Math]::Min($script:Failures, 9))
