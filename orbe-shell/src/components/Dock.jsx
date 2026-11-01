import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useShellStore } from '../store/shellStore'
import { findAppById } from '../lib/apps'
import { AppIcon } from './AppIcon'

// Dock flutuante inteligente: ampliação por proximidade do mouse, ocultação
// automática, reordenação por arrastar e menus de contexto completos.
export function Dock() {
  const dockApps = useShellStore((s) => s.dockApps)
  const nativeApps = useShellStore((s) => s.nativeApps)
  const dockSize = useShellStore((s) => s.dockSize)
  const magnify = useShellStore((s) => s.dockMagnify)
  const autoHide = useShellStore((s) => s.autoHideDock)
  const windows = useShellStore((s) => s.windows)
  const openApp = useShellStore((s) => s.openApp)
  const dockRemove = useShellStore((s) => s.dockRemove)
  const dockReorder = useShellStore((s) => s.dockReorder)
  const toggleStart = useShellStore((s) => s.toggleStart)

  const [mouseX, setMouseX] = useState(null)
  const [hovered, setHovered] = useState(!autoHide)
  const [ctx, setCtx] = useState(null) // {appId, x, y}
  const [dragIdx, setDragIdx] = useState(null)

  const running = new Set(windows.map((w) => w.appId))

  const onMove = (e) => { if (magnify) setMouseX(e.clientX) }

  const itemScale = (idx) => {
    if (!magnify || mouseX == null) return 1
    const el = document.getElementById(`dock-item-${idx}`)
    if (!el) return 1
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const d = Math.abs(mouseX - cx)
    const range = dockSize * 3.4
    if (d > range) return 1
    const t = 1 - d / range
    return 1 + 0.55 * t * t // curva suave quadrática
  }

  return (
    <>
      <AnimatePresence>
        {ctx && <DockContext ctx={ctx} onClose={() => setCtx(null)} dockRemove={dockRemove} openApp={openApp} />}
      </AnimatePresence>

      <motion.div
        className="dock glass"
        animate={{ y: autoHide && !hovered ? dockSize + 46 : 0, opacity: autoHide && !hovered ? 0 : 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setMouseX(null) }}
        onMouseMove={onMove}
      >
        <button className="dock-orbe" onClick={toggleStart} title="Menu Orbe">
          <span className="orbe-core" />
        </button>
        <span className="dock-sep" />
        {dockApps.map((appId, idx) => {
          const app = findAppById(appId, nativeApps)
          if (!app) return null
          const scale = itemScale(idx)
          return (
            <div
              key={appId}
              id={`dock-item-${idx}`}
              className="dock-slot"
              style={{ width: dockSize + 14 }}
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragIdx != null && dragIdx !== idx) dockReorder(dragIdx, idx); setDragIdx(null) }}
              onMouseDown={(e) => { if (e.button === 2) return }}
              onClick={() => openApp(appId)}
              onContextMenu={(e) => { e.preventDefault(); setCtx({ appId, x: e.clientX, y: e.clientY }) }}
            >
              <motion.div animate={{ scale, y: (scale - 1) * -(dockSize * 0.32) }} transition={{ type: 'spring', stiffness: 420, damping: 24 }} style={{ transformOrigin: 'bottom center' }}>
                <AppIcon app={app} size={dockSize} active={running.has(appId)} />
              </motion.div>
              {running.has(appId) && <span className="dock-dot" />}
              <span className="dock-tip">{app.name}</span>
            </div>
          )
        })}
      </motion.div>
    </>
  )
}

function DockContext({ ctx, onClose, dockRemove, openApp }) {
  const nativeApps = useShellStore((s) => s.nativeApps)
  const app = findAppById(ctx.appId, nativeApps)
  if (!app) return null
  const act = (fn) => () => { fn(); onClose() }
  return (
    <motion.div
      className="menu glass-strong"
      initial={{ opacity: 0, scale: 0.9, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: 6 }}
      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
      style={{ left: Math.min(ctx.x, window.innerWidth - 240), top: ctx.y - 120 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="menu-head"><AppIcon app={app} size={22} radius={6} /><span>{app.name}</span></div>
      <button onClick={act(() => openApp(ctx.appId))}>Abrir janela</button>
      <button onClick={act(() => window.dispatchEvent(new CustomEvent('orbe:snap-helper')))}>Encaixar à esquerda</button>
      <button onClick={act(() => openApp(ctx.appId))}>Nova instância</button>
      <div className="menu-sep" />
      <button onClick={act(() => dockRemove(ctx.appId))}>Remover do Dock</button>
      <button className="danger" onClick={act(() => useShellStore.getState().emergencyRecovery())}>Recuperação de emergência</button>
    </motion.div>
  )
}
