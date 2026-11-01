import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useShellStore } from '../store/shellStore'
import { APPS } from '../lib/apps'
import { AppIcon } from './AppIcon'
import { Icon } from './icons/Icons'

// Área de trabalho: ícones arrastáveis + widgets flutuantes
const DESKTOP_ICONS = [
  { id: 'pc', name: 'Este Computador', app: 'explorer' },
  { id: 'trash', name: 'Lixeira', app: 'security' },
  { id: 'docs', name: 'Documentos', app: 'files' },
  { id: 'proj', name: 'Projetos Orbe', app: 'editor' },
  { id: 'dl', name: 'Downloads', app: 'explorer' },
]

export function Desktop() {
  const show = useShellStore((s) => s.showDesktopIcons)
  const openApp = useShellStore((s) => s.openApp)
  const [pos, setPos] = useState(() => {
    const saved = localStorage.getItem('orbe-desktop-icons')
    if (saved) return JSON.parse(saved)
    const o = {}
    DESKTOP_ICONS.forEach((ic, i) => { o[ic.id] = { x: 26, y: 60 + i * 96 } })
    return o
  })
  const [drag, setDrag] = useState(null)


  useEffect(() => { localStorage.setItem('orbe-desktop-icons', JSON.stringify(pos)) }, [pos])

  const startMove = (id, e) => {
    e.preventDefault()
    setDrag({ id, sx: e.clientX, sy: e.clientY, ox: pos[id].x, oy: pos[id].y, moved: false })
  }
  useEffect(() => {
    if (!drag) return
    const move = (ev) => {
      const dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true
      setPos((p) => ({ ...p, [drag.id]: { x: Math.max(0, drag.ox + dx), y: Math.max(44, drag.oy + dy) } }))
    }
    const up = () => setDrag(null)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [drag?.id])

  if (!show) return null
  return (
    <div className="desktop-icons">
      {DESKTOP_ICONS.map((ic) => (
        <div key={ic.id} className="dicon" style={{ left: pos[ic.id]?.x, top: pos[ic.id]?.y }}
          onPointerDown={(e) => startMove(ic.id, e)}
          onDoubleClick={() => !drag?.moved && openApp(ic.app)}>
          <AppIcon app={APPS[ic.app]} size={44} radius={12} />
          <span>{ic.name}</span>
        </div>
      ))}
    </div>
  )
}

// Widgets flutuantes no canto superior direito
export function Widgets() {
  const w = useShellStore((s) => s.widgets)
  const [now, setNow] = useState(new Date())
  const [cpu, setCpu] = useState(12)
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    const c = setInterval(() => setCpu(8 + Math.round(Math.random() * 30)), 1500)
    return () => { clearInterval(t); clearInterval(c) }
  }, [])

  return (
    <div className="widgets">
      {w.clock && (
        <motion.div className="widget glass" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}>
          <div className="w-time">{now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
          <div className="w-sub">{now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </motion.div>
      )}
      {w.weather && (
        <motion.div className="widget glass" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }}>
          <div className="w-row"><Icon name="sun" size={22} color="#ffd166" /><b className="w-temp">23°</b></div>
          <div className="w-sub">Parcialmente nublado · São Paulo</div>
        </motion.div>
      )}
      {w.music && <MusicWidget />}
      {w.monitor && (
        <motion.div className="widget glass" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}>
          <div className="w-sub">Desempenho</div>
          <div className="bar"><span style={{ width: `${cpu}%` }} /></div>
          <div className="w-sub small">CPU {cpu}% · GPU 7% · 120 fps alvo</div>
        </motion.div>
      )}
    </div>
  )
}

function MusicWidget() {
  const [playing, setPlaying] = useState(false)
  const [track, setTrack] = useState(0)
  const tracks = ['Órbita Azul — Nebula Drive', 'Vidro Líquido — Soft Static', 'Aurora — Night Terminal']
  return (
    <motion.div className="widget glass music" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}>
      <div className="w-sub">Tocando agora</div>
      <div className="m-track">{tracks[track]}</div>
      <div className="m-bar"><motion.span animate={{ width: playing ? '100%' : '30%' }} transition={{ duration: playing ? 20 : 0.3, ease: 'linear' }} /></div>
      <div className="m-ctrls">
        <button onClick={() => setTrack((t) => (t + 2) % 3)}><Icon name="prev" size={14} /></button>
        <button className="play" onClick={() => setPlaying(!playing)}><Icon name={playing ? 'min' : 'play'} size={14} /></button>
        <button onClick={() => setTrack((t) => (t + 1) % 3)}><Icon name="next" size={14} /></button>
      </div>
    </motion.div>
  )
}
