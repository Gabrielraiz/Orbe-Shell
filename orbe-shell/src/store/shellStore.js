import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_DOCK, INTERNAL_APPS, fromNative } from '../lib/apps'
import { wallpaperById } from '../lib/wallpapers'
import { appCatalog, launchApp, IS_TAURI } from '../lib/native'

let nextId = 100
const uid = () => `w${nextId++}`

const BASE_POS = [
  { x: 60, y: 48 }, { x: 130, y: 90 }, { x: 210, y: 52 }, { x: 300, y: 110 },
  { x: 400, y: 70 }, { x: 520, y: 120 }, { x: 660, y: 60 }, { x: 820, y: 100 },
]

// Posição em cascata para novas janelas de um mesmo app
function cascade(appId, count) {
  const base = BASE_POS[count % BASE_POS.length]
  return { x: Math.min(base.x + (count * 26) % 120, window.innerWidth - 760), y: Math.min(base.y + (count * 22) % 90, window.innerHeight - 520) }
}

export const useShellStore = create(
  persist(
    (set, get) => ({
      // ── Aparência ────────────────────────────────────────────────
      wallpaper: 'aurora',
      opacity: 0.72,          // transparência do vidro
      blur: 22,               // desfoque em px
      animSpeed: 1,           // multiplicador de velocidade das animações
      reduceFx: false,        // modo desempenho / accessibility
      dockSize: 52,
      dockMagnify: true,
      autoHideDock: false,
      showDesktopIcons: true,

      setWallpaper: (id) => set({ wallpaper: id }),
      setOpacity: (v) => set({ opacity: v }),
      setBlur: (v) => set({ blur: v }),
      setAnimSpeed: (v) => set({ animSpeed: v }),
      setReduceFx: (v) => set({ reduceFx: v }),
      setDockSize: (v) => set({ dockSize: v }),
      setDockMagnify: (v) => set({ dockMagnify: v }),
      setAutoHideDock: (v) => set({ autoHideDock: v }),
      setShowDesktopIcons: (v) => set({ showDesktopIcons: v }),

      // ── Aplicativos reais do sistema (Tauri) ─────────────────────
      nativeApps: [],   // itens de UI derivados dos atalhos reais do SO
      nativeStatus: IS_TAURI ? 'loading' : 'web', // loading | ok | error | web
      loadNativeApps: async () => {
        if (!IS_TAURI) return set({ nativeStatus: 'web' })
        try {
          const list = await appCatalog()
          const ui = list.map((e) => ({ ...fromNative(e), native: e }))
          set({ nativeApps: ui, nativeStatus: 'ok' })
          // Dock padrão enriquecido: se o usuário nunca personalizou, inclui apps reais populares quando existem
          if (!localStorage.getItem('orbe-dock-customized')) {
            const wanted = ['notepad', 'msedge', 'calculator', 'explorer']
            const extra = ui.filter((a) => wanted.some((w) => a.nativeId.includes(w))).slice(0, 3).map((a) => a.id)
            if (extra.length) set({ dockApps: [...DEFAULT_DOCK, ...extra] })
          }
        } catch (e) {
          get().pushContinuity(`Catálogo de aplicativos indisponível: ${e}`)
          set({ nativeStatus: 'error' })
        }
      },

      // Resolve qualquer id: interno ("files") ou nativo ("sys:xxx")
      findApp: (id) => INTERNAL_APPS[id] || get().nativeApps.find((a) => a.id === id) || null,

      // ── Dock ─────────────────────────────────────────────────────
      dockApps: DEFAULT_DOCK,
      dockAdd: (appId) => { localStorage.setItem('orbe-dock-customized', '1'); set((s) => (s.dockApps.includes(appId) ? s : { dockApps: [...s.dockApps, appId] })) },
      dockRemove: (appId) => { localStorage.setItem('orbe-dock-customized', '1'); set((s) => ({ dockApps: s.dockApps.filter((a) => a !== appId) })) },
      dockReorder: (from, to) =>
        set((s) => {
          const arr = [...s.dockApps]
          const [item] = arr.splice(from, 1)
          arr.splice(to, 0, item)
          return { dockApps: arr }
        }),

      // ── Modos inteligentes ───────────────────────────────────────
      mode: 'smart', // work | gamer | smart
      setMode: (m) =>
        set((s) => {
          if (m === 'gamer') return { mode: m, dockApps: ['files', 'terminal', 'tasks', 'notes', 'settings'] }
          if (m === 'work')
            return { mode: m, dockApps: ['files', 'calculator', 'notes', 'tasks', 'settings', 'studio'] }
          return { mode: m, dockApps: DEFAULT_DOCK }
        }),

      // ── Áreas de trabalho virtuais ───────────────────────────────
      desktops: ['Principal'],
      currentDesktop: 0,
      switchDesktop: (i) => set((s) => ({ currentDesktop: Math.max(0, Math.min(i, s.desktops.length - 1)) })),
      addDesktop: () => set((s) => ({ desktops: [...s.desktops, `Área ${s.desktops.length + 1}`] })),

      // ── Menu Iniciar ─────────────────────────────────────────────
      startOpen: false,
      startMode: 'full', // compact | full | smart
      toggleStart: () => set((s) => ({ startOpen: !s.startOpen })),
      closeStart: () => set({ startOpen: false }),
      setStartMode: (m) => set({ startMode: m }),

      // ── Orbe Studio ──────────────────────────────────────────────
      studioOpen: false,
      toggleStudio: () => set((s) => ({ studioOpen: !s.studioOpen })),

      // ── Widgets ──────────────────────────────────────────────────
      widgets: { clock: true, weather: true, music: true, monitor: false },
      toggleWidget: (k) => set((s) => ({ widgets: { ...s.widgets, [k]: !s.widgets[k] } })),

      // ── Janelas ──────────────────────────────────────────────────
      windows: [],
      zTop: 10,
      focused: null,

      openApp: (appId) => {
        const s = get()
        const app = s.findApp(appId)
        if (!app) {
          s.pushContinuity(`Aplicativo não encontrado: ${appId}`)
          return
        }
        // Aplicativo real do sistema → lança via backend nativo (sem janela falsa)
        if (app.kind === 'system') {
          if (!IS_TAURI) {
            s.pushContinuity('Abrir aplicativos do sistema exige o app nativo (Tauri). Recarregue com "npm run tauri:dev".')
            return
          }
          launchApp(app.native.target)
            .then(() => s.pushContinuity(`Iniciado: ${app.name}`))
            .catch((e) => s.pushContinuity(`Falha ao iniciar ${app.name}: ${e}`))
          return
        }
        const existing = s.windows.find((w) => w.appId === appId && !w.minimized)
        if (existing) {
          set({ focused: existing.id })
          return
        }
        const minimized = s.windows.find((w) => w.appId === appId && w.minimized)
        if (minimized) {
          set((st) => ({
            windows: st.windows.map((w) => (w.id === minimized.id ? { ...w, minimized: false, z: st.zTop + 1 } : w)),
            focused: minimized.id,
            zTop: st.zTop + 1,
          }))
          return
        }
        const count = s.windows.filter((w) => w.appId === appId).length
        const pos = cascade(appId, count)
        const win = {
          id: uid(),
          appId,
          title: appId,
          x: pos.x, y: pos.y,
          w: appId === 'studio' ? 880 : 720,
          h: appId === 'studio' ? 560 : 480,
          maximized: false, snapping: null, genie: false, minimized: false,
          desktop: s.currentDesktop,
          z: s.zTop + 1,
        }
        set((st) => ({ windows: [...st.windows, win], focused: win.id, zTop: st.zTop + 1 }))
      },

      closeWindow: (id) =>
        set((s) => ({
          windows: s.windows.filter((w) => w.id !== id),
          focused: s.focused === id ? null : s.focused,
        })),

      minimizeWindow: (id) =>
        set((s) => ({
          windows: s.windows.map((w) => (w.id === id ? { ...w, minimized: true } : w)),
          focused: s.focused === id ? null : s.focused,
        })),

      toggleMaximize: (id) =>
        set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, maximized: !w.maximized } : w)) })),

      focusWindow: (id) =>
        set((s) => ({
          windows: s.windows.map((w) => (w.id === id ? { ...w, z: s.zTop + 1 } : w)),
          focused: id,
          zTop: s.zTop + 1,
        })),

      moveWindow: (id, x, y) =>
        set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, x, y } : w)) })),

      resizeWindow: (id, w, h) =>
        set((s) => ({ windows: s.windows.map((win) => (win.id === id ? { ...win, w, h } : win)) })),

      setSnapping: (id, zone) => set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, snapping: zone } : w)) })),

      snapWindow: (id, side) => {
        const vw = window.innerWidth, vh = window.innerHeight - 70
        const zones = {
          left: { x: 8, y: 8, w: vw / 2 - 16, h: vh - 16 },
          right: { x: vw / 2 + 8, y: 8, w: vw / 2 - 16, h: vh - 16 },
          top: { x: 8, y: 8, w: vw - 16, h: vh - 16 },
          tl: { x: 8, y: 8, w: vw / 2 - 16, h: vh / 2 - 16 },
          tr: { x: vw / 2 + 8, y: 8, w: vw / 2 - 16, h: vh / 2 - 16 },
          bl: { x: 8, y: vh / 2 + 8, w: vw / 2 - 16, h: vh / 2 - 16 },
          br: { x: vw / 2 + 8, y: vh / 2 + 8, w: vw / 2 - 16, h: vh / 2 - 16 },
        }
        const z = zones[side]
        if (!z) return
        set((s) => ({
          windows: s.windows.map((w) => (w.id === id ? { ...w, ...z, maximized: false, snapping: null } : w)),
        }))
      },

      // Efeito Genie: marca a janela para "sugar" em direção ao dock antes de minimizar
      genieMinimize: (id, targetX) =>
        set((s) => ({
          windows: s.windows.map((w) => (w.id === id ? { ...w, genie: true, genieTargetX: targetX } : w)),
        })),
      finishGenie: (id) =>
        set((s) => ({
          windows: s.windows.map((w) => (w.id === id ? { ...w, genie: false, minimized: true } : w)),
          focused: s.focused === id ? null : s.focused,
        })),

      // ── Continuity / emergência ──────────────────────────────────
      continuityLog: [],
      pushContinuity: (msg) => set((s) => ({ continuityLog: [...s.continuityLog.slice(-19), { t: Date.now(), msg }] })),
      emergencyRecovery: () => {
        const s = get()
        set({
          windows: s.windows.map((w) => ({ ...w, genie: false, snapping: null })),
          startOpen: false,
          studioOpen: false,
        })
        get().pushContinuity('Recuperação de emergência concluída — estado da interface restaurado.')
      },
    }),
    {
      name: 'orbe-shell-settings',
      partialize: (s) => ({
        wallpaper: s.wallpaper, opacity: s.opacity, blur: s.blur, animSpeed: s.animSpeed,
        reduceFx: s.reduceFx, dockSize: s.dockSize, dockMagnify: s.dockMagnify,
        autoHideDock: s.autoHideDock, dockApps: s.dockApps, mode: s.mode,
        startMode: s.startMode, widgets: s.widgets,
      }),
    }
  )
)

export function accentFor(state) {
  return wallpaperById(state.wallpaper)
}
