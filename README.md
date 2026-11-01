# Orbe Shell 1.1.0.4

Aplicativo nativo de shell para Windows construído com **Tauri 2 (Rust)** e **React 19**.
Substitui a experiência visual do desktop por um ambiente Liquid Glass completo — Dock,
Menu Iniciar, janelas com snap e efeito Genie, widgets, Studio de personalização — usando
integrações reais com o sistema operacional (atalhos .lnk, processos, volume, papel de
parede, registro). Nenhum painel exibe dados simulados: fora do app nativo cada módulo
declara explicitamente que exige o backend Rust.

**Filosofia:** beleza, fluidez, desempenho, inteligência e liberdade de personalização
funcionando juntos — um sistema que não apenas pareça moderno, mas que seja agradável
de utilizar em cada interação.

## Requisitos (Windows)

- Node.js >= 18 (LTS recomendado)
- Rust (rustup) com toolchain `stable-msvc`
- Visual Studio Build Tools 2022 (workload "Desktop development with C++")
- WebView2 Runtime (presente no Windows 11; instalador automático no Windows 10)

## Como rodar

```powershell
cd orbe-shell
npm install
npm run tauri:dev        # desenvolvimento (hot reload)
npm run tauri:build      # gera o instalador .exe (NSIS) em src-tauri/target/release/bundle
```

Atalho recomendado — script de verificação completa que instala dependências, roda os
testes unitários, oxlint, vite build, cargo check e grava um relatório `.log` datado em
`scripts/logs/`:

```powershell
.\scripts\dev.ps1            # diagnóstico completo
.\scripts\dev.ps1 -Tests     # + testes unitários detalhados
.\scripts\dev.ps1 -Dev       # diagnóstico e abre o aplicativo
.\scripts\dev.ps1 -Build     # diagnóstico e gera o instalador
.\scripts\dev.ps1 -Full      # tudo
```

## Os 12 pilares — agora como funcionalidades reais

| # | Pilar | Status em 1.1.0.4 |
|---|-------|-------------------|
| 1 | Liquid Glass Premium | Escuro translúcido, blur real, cores dinâmicas extraídas do papel de parede ativo |
| 2 | Animações fluidas | Springs do Framer Motion, efeito Genie ao minimizar, velocidade global ajustável no Studio |
| 3 | Dock inteligente | Magnificação, ocultação automática, reordenação por arrastar, menus de contexto, enriquecido com apps reais do SO |
| 4 | Menu Iniciar adaptável | Modos Compacto/Completo/Inteligente, pesquisa sobre atalhos reais do Windows, tecla Windows abre/fecha |
| 5 | Gerenciamento de janelas | Snap por bordas/cantos com preview, maximizar, múltiplas áreas de trabalho |
| 6 | Área de trabalho | Ícones arrastáveis com posição persistida, widgets reais (relógio, clima Open-Meteo, música local, monitor CPU/RAM via perf_stats) |
| 7 | Orbe Studio | Cores, glass, dock, animações, modos e widgets — tudo persistido |
| 8 | Desempenho | Redução automática de efeitos, GPU via CSS, otimizações por hardware |
| 9 | Modos inteligentes | Gamer / Trabalho / Inteligente alteram Dock e favoritos |
| 10 | Orbe Continuity | Verificação de saúde real sondando cada comando Rust; recuperação de emergência restaura o estado da interface |
| 11 | Update Center | Consulta releases via PowerShell/HTTPS, confirmação explícita antes de baixar e executar o instalador |
| 12 | Segurança | Permissões Tauri por capability, proteção de processos críticos, fallback do Explorer via registro com backup e rollback |

## Módulos nativos (comandos Rust)

- `sys_info`, `battery_info`, `perf_stats` — sistema, bateria, CPU/RAM em tempo real
- `app_catalog`, `launch_app`, `resolve_shortcut` — atalhos .lnk/.desktop do usuário e todos os programas
- `list_processes`, `end_process` — gerenciador de tarefas com memória real (Working Set) e bloqueio de processos críticos
- `read_dir_entries`, `read_text_file`, `write_text_file`, `delete_path` — explorador restrito à pasta do usuário
- `set_wallpaper`, `current_wallpaper` — SystemParametersInfoW
- `audio_state`, `audio_set_volume`, `audio_toggle_mute` — Endpoint Volume API (COM)
- `check_latest_version`, `download_and_run_installer` — atualização distribuída somente HTTPS
- `set_explorer_fallback`, `get_explorer_fallback` — substituição profunda do shell com rollback automático

## Estrutura

```
orbe-shell/
├── scripts/dev.ps1          # verificação/testes/diagnóstico com log
├── tests/core.test.mjs      # testes unitários (node --test tests/)
├── src/                     # frontend React (store, componentes, ponte native.js)
└── src-tauri/               # backend Rust
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── capabilities/        # permissões por componente
    └── src/commands/        # system, apps, fs, processes, wallpaper, audio, update, shell
```

Stack: **React 19 · Vite · Zustand · Framer Motion · Tauri 2 · Rust (windows-rs)**

## Roadmap

- Orbe Window Bridge: efeitos e snap em aplicativos externos (WinEvent hooks)
- Substituição completa do Explorer como shell padrão (opção segura no Continuity)
- Rollback assinado de atualizações e canais beta/experimental com checksum
- Suporte a toque e gestos; otimizações automáticas por hardware

> Versão 1.1.0.4 — foco: correções de build/lint, sincronização de versão, módulos reais
> (volume, calculadora sem eval, explorer, tarefas, update) e script de diagnóstico.
