// Ponte entre a interface e o backend nativo Rust (Tauri 2).
// Em modo web (npm run dev sem Tauri) as chamadas falham de forma amigável e
// os painéis mostram "nativo indisponível" em vez de dados inventados.
import { invoke } from '@tauri-apps/api/core'

export const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

async function call(cmd, args) {
  if (!IS_TAURI) throw new Error('modo-web')
  return invoke(cmd, args)
}

// ── Sistema ────────────────────────────────────────────────────────
export const sysInfo = () => call('sys_info')
export const batteryInfo = () => call('battery_info')
export const perfStats = () => call('perf_stats')

// ── Aplicativos reais (atalhos do Windows / .desktop do Linux) ────
export const appCatalog = () => call('app_catalog')
export const launchApp = (target) => call('launch_app', { target })
export const resolveShortcut = (source) => call('resolve_shortcut', { source })

// ── Arquivos (restrito à pasta do usuário) ─────────────────────────
export const readDir = (path) => call('read_dir_entries', { path })
export const readFile = (path) => call('read_text_file', { path })
export const writeFile = (path, contents) => call('write_text_file', { path, contents })
export const deleteEntry = (path) => call('delete_entry', { path })

// ── Processos (Gerenciador de Tarefas real) ────────────────────────
export const listProcesses = () => call('list_processes')
export const endProcess = (pid, name) => call('end_process', { pid, name })

// ── Papel de parede real do sistema ────────────────────────────────
export const currentWallpaper = () => call('current_wallpaper')
export const setSystemWallpaper = (path) => call('set_wallpaper', { path })

// ── Fallback do Explorer (substituição profunda do shell) ──────────
export const getExplorerFallback = () => call('get_explorer_fallback')
export const setExplorerFallback = (enable) => call('set_explorer_fallback', { enable })

// ── Janela nativa (controles via plugin window) ────────────────────
let _win = null
export async function nativeWindow() {
  if (!IS_TAURI) return null
  if (!_win) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    _win = getCurrentWindow()
  }
  return _win
}

export async function startNativeDrag() {
  const w = await nativeWindow()
  if (w) { try { await w.startDragging() } catch { /* ignora */ } }
}
