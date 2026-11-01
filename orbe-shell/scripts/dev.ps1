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

# Redirecionamentos 2>&1 fazem o PowerShell tratar avisos de stderr como erro
# (NativeCommandError). Isso polui o log e pode abortar etapas. Normalizamos.
if (-not (Get-Variable PSNativeCommandErrorMaxFunctionCount -ErrorAction SilentlyContinue)) {
    $global:PSNativeCommandErrorMaxFunctionCount = [int]::MaxValue
}
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
    param([string]$Name, [string]$Cmd, [string[]]$CmdArgs, [int]$WarnExitCode = -1)
    Section $Name
    Log "> $Cmd $($CmdArgs -join ' ')"
    # Captura stdout+stderr sem que o PowerShell converta stderr em erro fatal.
    # 2>&1 preserva a ordem real das linhas; EAP='Stop' dentro do try transforma
    # falha de execucao em excecao capturavel (cmd nao encontrado, etc).
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Stop'
    try {
        $raw = & $Cmd @CmdArgs 2>&1 | ForEach-Object { "$_" }
    } catch {
        $raw = @("ERRO AO EXECUTAR '$Cmd': " + $_.Exception.Message)
    }
    $ErrorActionPreference = 'Continue'
    $code = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 1 }
    $text = (($raw | Out-String) -replace "`r", '')
    if ($text.Trim()) { Log $text.TrimEnd() }

    # Filtro anti-poluicao: avisos benignos de tooling (rolldown/vite e npm)
    # ganham contexto explicito no relatorio em vez de parecerem erros.
    $harmless = @('INEFFECTIVE_DYNAMIC_IMPORT', 'NativeCommandError', 'C:\Program Files\nodejs')
    $suspicious = $raw | Where-Object {
        $line = "$_"
        ($line -match '(?i)\berror\b|erro|\bwarn(ing)?\b|aviso|fail') -and
        -not ($harmless | Where-Object { $line -like "*$_*" })
    }
    if ($suspicious) {
        Log ''
        Log '--- Linhas relevantes (erros/avisos verdadeiros) ---'
        $suspicious | Select-Object -First 30 | ForEach-Object { Log "  ! $_" }
    }

    if ($code -eq 0) {
        Log "[OK] $Name"
    } elseif ($WarnExitCode -ge 0 -and $code -le $WarnExitCode) {
        Log "[AVISO] $Name terminou com codigo $code (avisos detectados - veja acima)."
        $script:Warnings++
        $warnLines = $out | Select-String -Pattern 'warning|⚠' | ForEach-Object { $_.ToString().Trim() } | Select-Object -Unique
        if ($warnLines) {
            Log ''
            Log '--- Itens a corrigir (avisos) ---'
            $warnLines | ForEach-Object { Log "  * $_" }
        }
    } else {
        Log "[FALHA] $Name terminou com codigo $code."
        $script:Failures++
        Log ''
        Log '--- O que fazer ---'
        switch -Regex ($Name) {
            'npm install'      { Log '  * Verifique conexao com a internet e a versao do Node (>=18). Rode: node --version' }
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
# 0a) Auto-sync de versao (fonte da verdade: package.json)
#     Se qualquer arquivo divergir, e corrigido automaticamente ANTES das
#     verificacoes. Rust exige semver X.Y.Z; o sufixo de build (.N) vira
#     metadados "+N" no Cargo.toml/tauri.conf.json (validos e ignorados pelo
#     resolver), mantendo as quatro fontes na mesma versao base.
# ---------------------------------------------------------------------------
Section 'Sincronizacao de versao'
$pkgTxt = Get-Content (Join-Path $Root 'package.json') -Raw
$pkgV = ($pkgTxt | ConvertFrom-Json).version
if ($pkgV -notmatch '^(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?$') {
    Log "[FALHA] Versao em package.json invalida: '$pkgV' (esperado X.Y.Z ou X.Y.Z.N)."
    $script:Failures++
} else {
    $base = "$($Matches[1]).$($Matches[2]).$($Matches[3])"
    $build = $Matches[4]
    $semver = if ($build) { "$base+$build" } else { $base }
    Log "package.json define a versao: $pkgV (semver Rust: $semver)"

    $cargoFile = Join-Path $Root 'src-tauri\Cargo.toml'
    $confFile  = Join-Path $Root 'src-tauri\tauri.conf.json'
    $appsFile  = Join-Path $Root 'src\lib\apps.js'

    $cargoTxt = Get-Content $cargoFile -Raw
    $newCargo = $cargoTxt -replace '(?m)^version\s*=\s*"[^"]+"', "version = `"$semver`""
    if ($newCargo -ne $cargoTxt) { Set-Content $cargoFile $newCargo -NoNewline -Encoding UTF8; Log '  Cargo.toml atualizado para.' }

    $confTxt = Get-Content $confFile -Raw
    $newConf = $confTxt -replace '("version"\s*:\s*")[^"]+(")', "`$1$base`$2"
    if ($newConf -ne $confTxt) { Set-Content $confFile $newConf -NoNewline -Encoding UTF8; Log '  tauri.conf.json atualizado para base.' }

    $appsTxt = Get-Content $appsFile -Raw
    $newApps = $appsTxt -replace "(VERSION\s*=\s*')[^']+(')", "`${1}$pkgV`${2}"
    if ($newApps -ne $appsTxt) { Set-Content $appsFile $newApps -NoNewline -Encoding UTF8; Log '  apps.js atualizado para pkg.' }

    # Releitura para confirmacao
    $okCargo = (Get-Content $cargoFile -Raw) -match [regex]::Escape("`"$semver`"")
    $okConf  = (Get-Content $confFile -Raw)  -match [regex]::Escape("`"$base`"")
    $okApps  = (Get-Content $appsFile -Raw)  -match [regex]::Escape("'$pkgV'")
    if ($okCargo -and $okConf -and $okApps) {
        Log '[OK] Versoes sincronizadas (package.json = tauri.conf = Cargo.toml = apps.js).'
    } else {
        Log "[FALHA] Auto-sync incompleto: cargo=$okCargo conf=$okConf apps=$okApps"
        $script:Failures++
    }
}

# ---------------------------------------------------------------------------
# 0b) Ambiente
# ---------------------------------------------------------------------------
Section 'Ambiente'
foreach ($t in @(
    @{ n = 'Node.js';  c = 'node';  a = @('--version'); min = 18 },
    @{ n = 'npm';      c = 'npm';   a = @('--version'); min = $null },
    @{ n = 'Rust';     c = 'cargo'; a = @('--version'); min = $null }
)) {
    $cmd = Get-Command $t.c -ErrorAction SilentlyContinue
    if (-not $cmd) {
        Log "[AUSENTE] $($t.n) nao encontrado no PATH."
        if ($t.n -eq 'Rust') { Log '  Instale com: winget install Rustlang.Rustup  (depois reabra o terminal)' }
        else { Log '  Instale Node LTS em https://nodejs.org'; $script:Failures++ }
        continue
    }
    $v = & $t.c $t.a 2>&1 | Select-Object -First 1
    Log "[OK] $($t.n): $v"
    if ($null -ne $t.min) {
        $major = ([regex]::Match("$v", '\d+')).Value -as [int]
        if ($major -lt $t.min) { Log "  AVISO: requer >= $($t.min)"; $script:Warnings++ }
    }
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
    Run-Step 'Testes unitarios (node --test tests/)' 'node' @('--test', 'tests/') | Out-Null
}

# ---------------------------------------------------------------------------
# 4) Lint (JS) - avisos nao bloqueiam, mas sao registrados
# ---------------------------------------------------------------------------
Run-Step 'Lint JavaScript (oxlint)' 'npx' @('oxlint') -WarnExitCode 1 | Out-Null

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
    Pop-Location
} else {
    Log '[PULADO] cargo nao disponivel - verificacao Rust ignorada neste ambiente.'
}

# ---------------------------------------------------------------------------
# 7) Dev ou Build do instalador
# ---------------------------------------------------------------------------
if ($Dev) {
    Section 'Modo desenvolvimento (Tauri)'
    Log 'Iniciando npm run tauri:dev ... (Ctrl+C para sair)'
    & npm run tauri:dev
}
if ($Build -or $Full) {
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
