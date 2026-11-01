// Orbe Shell 1.0 — aplicativos REAIS do sistema.
// Em modo nativo (Tauri), o catálogo vem dos atalhos reais do Windows/Linux e
// cada item abre o aplicativo de verdade via backend Rust.
// Em modo web (desenvolvimento sem Tauri) não há apps instalados acessíveis:
// a interface mostra apenas as ferramentas internas do próprio shell, que são
// genuinamente funcionais — nada é inventado.

export const VERSION = '1.1.0.1'

// Ferramentas internas do Orbe (código real, executado dentro do shell)
export const INTERNAL_APPS = {
  studio: { id: 'studio', name: 'Orbe Studio', kind: 'internal', color1: '#c678ff', color2: '#6d4aff', glyph: 'sliders' },
  files: { id: 'files', name: 'Explorador de Arquivos', kind: 'internal', color1: '#ffc861', color2: '#f0a02e', glyph: 'folder' },
  tasks: { id: 'tasks', name: 'Gerenciador de Tarefas', kind: 'internal', color1: '#5ad1ff', color2: '#2f6fed', glyph: 'pulse' },
  terminal: { id: 'terminal', name: 'Console do Sistema', kind: 'internal', color1: '#3a3f4b', color2: '#15171d', glyph: 'term' },
  calculator: { id: 'calculator', name: 'Calculadora', kind: 'internal', color1: '#8ee6a8', color2: '#2fae66', glyph: 'calc' },
  notes: { id: 'notes', name: 'Notas', kind: 'internal', color1: '#ffe27a', color2: '#f2b705', glyph: 'note' },
  settings: { id: 'settings', name: 'Configurações do Sistema', kind: 'internal', color1: '#9aa4b2', color2: '#5b6472', glyph: 'gear' },
  update: { id: 'update', name: 'Central de Atualização', kind: 'internal', color1: '#9d8cff', color2: '#6655e0', glyph: 'refresh' },
  continuity: { id: 'continuity', name: 'Orbe Continuity', kind: 'internal', color1: '#57e6c1', color2: '#1fb08a', glyph: 'shield' },
  about: { id: 'about', name: 'Sobre o Orbe Shell', kind: 'internal', color1: '#7ee8fa', color2: '#2b7ff0', glyph: 'orb' },
}

export function internalApp(id) {
  return INTERNAL_APPS[id] || null
}

// Converte um AppEntry real do backend em item de interface.
const PALETTE = [
  ['#6ea8fe', '#3572e0'], ['#ff9f6e', '#e0553a'], ['#8ee6a8', '#2fae66'],
  ['#c69bff', '#7d4ae0'], ['#7ee8fa', '#2ba8c4'], ['#ffb3c7', '#e05c7f'],
  ['#ffd166', '#df9a1b'], ['#9fb4cc', '#5b7290'],
]

function hash(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function glyphFor(entry) {
  const t = ((entry.target || '') + ' ' + (entry.name || '')).toLowerCase()
  if (/msedge|firefox|chrome|browser|navegador/.test(t)) return 'globe'
  if (/terminal|cmd|powershell|wt\.exe|bash/.test(t)) return 'term'
  if (/music|spotify|media|player|wmplayer/.test(t)) return 'music'
  if (/photo|fotos|image/.test(t)) return 'image'
  if (/mail|outlook|email|thunderbird/.test(t)) return 'mail'
  if (/calc/.test(t)) return 'calc'
  if (/game|jogo|steam|epic|minecraft/.test(t)) return 'game'
  if (/store|loja/.test(t)) return 'bag'
  if (/calendar|agenda/.test(t)) return 'calendar'
  if (/editor|code|notepad|notes|word|write|jetbrains|vscode/.test(t)) return 'note'
  if (/settings|config|control/.test(t)) return 'gear'
  return 'app'
}

export function fromNative(entry) {
  const [c1, c2] = PALETTE[hash(entry.name) % PALETTE.length]
  return {
    id: `sys:${entry.id}`,
    nativeId: entry.id,
    name: entry.name,
    kind: 'system',
    target: entry.target,
    source: entry.source,
    color1: c1,
    color2: c2,
    glyph: glyphFor(entry),
  }
}

// Dock padrão: ferramentas internas sempre funcionais no Windows e Linux
export const DEFAULT_DOCK = ['files', 'terminal', 'tasks', 'calculator', 'notes', 'settings', 'studio']

// Resolve qualquer id de aplicativo (interno "files" ou nativo "sys:xxx").
// `nativeApps` é a lista carregada do SO em runtime; sem ela, só internos.
export function findAppById(id, nativeApps = []) {
  if (INTERNAL_APPS[id]) return INTERNAL_APPS[id]
  if (typeof id === 'string' && id.startsWith('sys:')) {
    return nativeApps.find((a) => a.id === id) || null
  }
  return null
}

// Lista completa para busca/recentes: apps reais + internos.
export function allApps(nativeApps = []) {
  return [...Object.values(INTERNAL_APPS), ...nativeApps]
}
