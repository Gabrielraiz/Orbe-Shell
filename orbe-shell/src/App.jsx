import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useShellStore } from './store/shellStore'
import { wallpaperById } from './lib/wallpapers'
import { MenuBar } from './components/MenuBar'
import { Dock } from './components/Dock'
import { StartMenu } from './components/StartMenu'
import { Window } from './components/Window'
import { Desktop, Widgets } from './components/Desktop'
import { TopWidgets } from './components/ControlCenter'

export default function App() {
  const state = useShellStore()
  const wp = wallpaperById(state.wallpaper)
  const [menu, setMenu] = useState(null) // menu de contexto da área de trabalho
  const [booted, setBooted] = useState(false)

  // Tela de "boot" suave do shell (protótipo)
  useEffect(() => { const t = setTimeout(() => setBooted(true), 900); return () => clearTimeout(t) }, [])

  // Tecla Windows abre/fecha o menu do Orbe; Esc fecha overlays
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Meta') { e.preventDefault(); useShellStore.getState().toggleStart() }
      if (e.key === 'Escape') { useShellStore.getState().closeStart(); setMenu(null) }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey) }
  }, [])

  // Fecha menu de contexto ao clicar fora
  useEffect(() => {
    const close = () => setMenu(null)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [])

  // Variáveis CSS derivadas (cores dinâmicas + glass)
  const cssVars = useMemo(() => ({
    '--accent': wp.accent,
    '--accent2': wp.accent2,
    '--glow': wp.glow,
    '--glass-op': state.reduceFx ? Math.min(0.96, state.opacity + 0.18) : state.opacity,
    '--blur': state.reduceFx ? `${Math.min(state.blur, 6)}px` : `${state.blur}px`,
    '--wall-bg': wp.css,
  }), [wp, state.opacity, state.blur, state.reduceFx])

  const wins = state.windows.filter((w) => w.desktop === state.currentDesktop || w.appId === 'studio')

  return (
    <div className="shell" style={cssVars} onContextMenu={(e) => {
      if (e.target.classList.contains('wall') || e.target.classList.contains('wall-tint') || e.target.classList.contains('shell')) {
        e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY })
      }
    }}>
      <div className="wall" />
      <div className="wall-tint" />

      {!booted ? (
        <BootScreen />
      ) : (
        <>
          <MenuBar />
          <TopWidgets />
          <Desktop />
          <Widgets />

          {wins.map((w) => <Window key={w.id} win={w} />)}

          <StartMenu />
          <Dock />

          <AnimatePresence>
            {menu && <DeskMenu menu={menu} onClose={() => setMenu(null)} />}
          </AnimatePresence>
        </>
      )}
    </div>
  )
}

function BootScreen() {
  return (
    <motion.div className="boot" initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: 0.7 }}>
      <motion.span className="orbe-core big" animate={{ scale: [1, 1.15, 1], rotate: 360 }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} />
      <p>Iniciando Orbe Shell…</p>
    </motion.div>
  )
}

function DeskMenu({ menu, onClose }) {
  const s = useShellStore.getState()
  const act = (fn) => () => { fn && fn(); onClose() }
  return (
    <motion.div
      className="menu glass-strong desk-menu"
      initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 520, damping: 32 }}
      style={{ left: Math.min(menu.x, window.innerWidth - 250), top: Math.min(menu.y, window.innerHeight - 330) }}
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={act(() => s.openApp('studio'))}>Personalizar com Orbe Studio…</button>
      <button onClick={act(() => s.setShowDesktopIcons(!s.showDesktopIcons))}>{s.showDesktopIcons ? 'Ocultar ícones' : 'Mostrar ícones'}</button>
      <button onClick={act(() => s.addDesktop())}>Nova área de trabalho</button>
      <div className="menu-sep" />
      <button onClick={act(() => s.openApp('update'))}>Verificar atualizações…</button>
      <button onClick={act(() => s.openApp('continuity'))}>Orbe Continuity</button>
      <div className="menu-sep" />
      <button onClick={act(() => s.openApp('about'))}>Sobre o Orbe Shell</button>
    </motion.div>
  )
}
