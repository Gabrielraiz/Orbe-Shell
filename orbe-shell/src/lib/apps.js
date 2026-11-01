// Catálogo de aplicativos do Orbe Shell (protótipo)
// Em produção, estes seriam os ícones nativos reais dos aplicativos instalados.

export const APPS = {
  explorer: { id: 'explorer', name: 'Explorador de Arquivos', color1: '#ffc861', color2: '#f0a02e', glyph: 'folder' },
  edge: { id: 'edge', name: 'Orbe Browser', color1: '#37d5e0', color2: '#2b7ff0', glyph: 'globe' },
  store: { id: 'store', name: 'Loja Orbe', color1: '#54c8ff', color2: '#2f6fed', glyph: 'bag' },
  settings: { id: 'settings', name: 'Configurações', color1: '#9aa4b2', color2: '#5b6472', glyph: 'gear' },
  studio: { id: 'studio', name: 'Orbe Studio', color1: '#c678ff', color2: '#6d4aff', glyph: 'orb' },
  terminal: { id: 'terminal', name: 'Terminal', color1: '#3a3f4b', color2: '#15171d', glyph: 'term' },
  files: { id: 'files', name: 'Arquivos', color1: '#ffd166', color2: '#ff9f43', glyph: 'folder' },
  photos: { id: 'photos', name: 'Fotos', color1: '#7ee8fa', color2: '#ff8fb3', glyph: 'image' },
  music: { id: 'music', name: 'Música', color1: '#ff6b9d', color2: '#c44569', glyph: 'music' },
  mail: { id: 'mail', name: 'Correio', color1: '#6ab7ff', color2: '#3f6ad8', glyph: 'mail' },
  calendar: { id: 'calendar', name: 'Calendário', color1: '#ff7b72', color2: '#e0455e', glyph: 'calendar' },
  calculator: { id: 'calculator', name: 'Calculadora', color1: '#8ee6a8', color2: '#2fae66', glyph: 'calc' },
  notes: { id: 'notes', name: 'Notas', color1: '#ffe27a', color2: '#f2b705', glyph: 'note' },
  editor: { id: 'editor', name: 'Editor de Código', color1: '#6ea8fe', color2: '#3572e0', glyph: 'code' },
  gamepad: { id: 'gamepad', name: 'Central de Jogos', color1: '#7cf0a0', color2: '#1fa85e', glyph: 'game' },
  security: { id: 'security', name: 'Segurança Orbe', color1: '#5ad1ff', color2: '#2f7fd8', glyph: 'shield' },
  update: { id: 'update', name: 'Orbe Update Center', color1: '#9d8cff', color2: '#6655e0', glyph: 'refresh' },
  continuity: { id: 'continuity', name: 'Orbe Continuity', color1: '#57e6c1', color2: '#1fb08a', glyph: 'pulse' },
}

export const DEFAULT_DOCK = ['explorer', 'edge', 'store', 'mail', 'calendar', 'photos', 'music', 'editor', 'terminal', 'settings', 'studio']

export const ALL_APPS = Object.values(APPS)
