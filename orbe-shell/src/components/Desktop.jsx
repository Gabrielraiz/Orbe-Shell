import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useShellStore } from '../store/shellStore'
import { internalApp } from '../lib/apps'
import { Icon } from './icons/Icons'
import { AppIcon } from './AppIcon'
import * as native from '../lib/native'

// Área de trabalho: ícones que apontam para pastas REAIS da conta do usuário.
// Duplo clique abre a pasta no explorador interno (ou no gerenciador nativo).
const REAL_DIRS = [
  { id: 'home', name: 'Pasta do Usuário', dir: '' },
  { id: 'docs', name: 'Documentos', dir: 'Documents' },
  { id: 'dl', name: 'Downloads', dir: 'Downloads' },
  { id: 'desk', name: 'Área de Trabalho', dir: 'Desktop' },
  { id: 'pics', name: 'Imagens', dir: 'Pictures' },
]
const WEB_ICONS = [
  { id: 'files', name: 'Explorador de Arquivos', app: 'files' },
  { id: 'notes', name: 'Notas', app: 'notes' },
  { id: 'settings', name: 'Configurações', app: 'settings' },
]

export function Desktop() {
  const show = useShellStore((s) => s.showDesktopIcons)
  const openApp = useShellStore((s) => s.openApp)
  const pushContinuity = useShellStore((s) => s.pushContinuity)
  const icons = native.IS_TAURI ? REAL_DIRS : WEB_ICONS
  const [pos, setPos] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('orbe-desktop-icons') || 'null')
      if (saved) return saved
    } catch { /* dados corrompidos: recomeça */ }
    const o = {}
    icons.forEach((ic, i) => { o[ic.id] = { x: 26, y: 60 + i * 96 } })
    return o
  })
  const [drag, setDrag] = useState(null)

  // Geometria do arrasto em ref: o efeito global de ponteiro lê valores
  // atuais (sem estado obsoleto) e só depende da presença do arrasto.
  const dragRef = useRef(null)
  useEffect(() => { localStorage.setItem('orbe-desktop-icons', JSON.stringify(pos)) }, [pos])

  const startMove = (id, e) => {
    e.preventDefault()
    const d = { id, sx: e.clientX, sy: e.clientY, ox: pos[id]?.x ?? 26, oy: pos[id]?.y ?? 60, moved: false }
    dragRef.current = d
    setDrag(d)
  }
  useEffect(() => {
    if (!drag) return
    const move = (ev) => {
      const d = dragRef.current
      if (!d) return
      const dx = ev.clientX - d.sx, dy = ev.clientY - d.sy
      if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true
      setPos((p) => ({ ...p, [d.id]: { x: Math.max(0, d.ox + dx), y: Math.max(44, d.oy + dy) } }))
    }
    const up = () => { dragRef.current = null; setDrag(null) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [drag])

  const activate = async (ic) => {
    if (drag?.moved) return
    if (ic.app) return openApp(ic.app)
    // Pasta real: abre no explorador interno já na pasta correta
    openApp('files')
    window.dispatchEvent(new CustomEvent('orbe:open-dir', { detail: ic.dir }))
    pushContinuity(`Abrindo "${ic.name}" no Explorador de Arquivos.`)
  }

  if (!show) return null
  return (
    <div className="desktop-icons">
      {icons.map((ic) => (
        <div key={ic.id} className="dicon" style={{ left: pos[ic.id]?.x, top: pos[ic.id]?.y }}
          onPointerDown={(e) => startMove(ic.id, e)}
          onDoubleClick={() => activate(ic)}>
          <AppIcon app={internalApp('files')} size={44} radius={12} />
          <span>{ic.name}</span>
        </div>
      ))}
    </div>
  )
}

// Widgets flutuantes — todos com dados reais ou honestamente indisponíveis
export function Widgets() {
  const w = useShellStore((s) => s.widgets)
  return (
    <div className="widgets">
      {w.clock && <ClockWidget />}
      {w.weather && <WeatherWidget />}
      {w.music && <MusicWidget />}
      {w.monitor && <MonitorWidget />}
    </div>
  )
}

function ClockWidget() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  return (
    <motion.div className="widget glass" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}>
      <div className="w-time">{now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
      <div className="w-sub">{now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
    </motion.div>
  )
}

// Clima REAL via Open-Meteo (sem chave de API) + geolocalização do navegador.
function WeatherWidget() {
  const [data, setData] = useState({ phase: 'idle' })
  const fetchFor = (lat, lon) => {
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((j) => setData({
        phase: 'ok',
        temp: Math.round(j.current.temperature_2m),
        wind: Math.round(j.current.wind_speed_10m),
        desc: codeToText(j.current.weather_code),
        place: `${j.timezone}`,
      }))
      .catch((e) => setData({ phase: 'error', msg: `Sem conexão com a estação: ${e}` }))
  }
  useEffect(() => {
    if (!navigator.geolocation) {
      // fallback honesto: sem permissão de GPS, usa São Paulo como referência fixa
      fetchFor(-23.55, -46.63)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => fetchFor(p.coords.latitude.toFixed(2), p.coords.longitude.toFixed(2)),
      () => fetchFor(-23.55, -46.63),
      { timeout: 8000 }
    )
  }, [])
  const map = { idle: ['—', 'Consultando…'], ok: [`${data.temp}°`, `${data.desc} · vento ${data.wind} km/h`], error: ['—', data.msg] }
  const [big, sub] = map[data.phase]
  return (
    <motion.div className="widget glass" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }}>
      <div className="w-row"><Icon name="sun" size={22} color="#ffd166" /><b className="w-temp">{big}</b></div>
      <div className="w-sub">{sub}</div>
    </motion.div>
  )
}

function codeToText(c) {
  if (c === 0) return 'Céu limpo'
  if (c <= 2) return 'Parcialmente nublado'
  if (c === 3) return 'Nublado'
  if (c <= 48) return 'Névoa'
  if (c <= 67) return 'Chuva'
  if (c <= 77) return 'Neve'
  if (c <= 82) return 'Pancadas de chuva'
  if (c <= 99) return 'Tempestade'
  return '—'
}

// Player local: reproduz arquivos de áudio que o USUÁRIO escolher (dialog real).
function MusicWidget() {
  const audioRef = useRef(null)
  const [track, setTrack] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [err, setErr] = useState(null)

  const pick = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const file = await open({ multiple: false, filters: [{ name: 'Áudio', extensions: ['mp3', 'ogg', 'wav', 'flac', 'm4a'] }] })
      if (!file) return
      // Converte caminho em URL de recurso nativo reconhecida pelo WebView
      const { convertFileSrc } = await import('@tauri-apps/api/core')
      setTrack({ path: file, url: convertFileSrc(file) })
      setPlaying(false); setErr(null)
    } catch (e) {
      setErr(`Seletor de arquivo indisponível no navegador (${e}). Use o app nativo.`)
    }
  }

  const toggle = async () => {
    const a = audioRef.current
    if (!a || !track) return pick()
    if (playing) { a.pause(); setPlaying(false) }
    else { try { await a.play(); setPlaying(true) } catch (e) { setErr(String(e)) } }
  }

  return (
    <motion.div className="widget glass music" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}>
      <div className="w-sub">Player local</div>
      <div className="m-track">{track ? track.path.split(/[\\/]/).pop() : 'Nenhum arquivo escolhido'}</div>
      {track && <audio ref={audioRef} src={track.url} onEnded={() => setPlaying(false)} />}
      {err && <div className="w-sub">{err}</div>}
      <div className="m-ctrls">
        <button onClick={pick} title="Escolher arquivo de áudio"><Icon name="folder" size={14} /></button>
        <button className="play" onClick={toggle}><Icon name={playing ? 'min' : 'play'} size={14} /></button>
      </div>
    </motion.div>
  )
}

// Monitor REAL: perf_stats do backend (CPU delta + memória física)
const WEB_PERF_ERR = 'Dados de desempenho exigem o app nativo.'

function MonitorWidget() {
  const [perf, setPerf] = useState(null)
  const [err, setErr] = useState(() => (native.IS_TAURI ? null : WEB_PERF_ERR))
  useEffect(() => {
    if (!native.IS_TAURI) return
    let alive = true
    const tick = () => native.perfStats().then((p) => alive && setPerf(p)).catch((e) => alive && setErr(String(e)))
    tick()
    const t = setInterval(tick, 2000)
    return () => { alive = false; clearInterval(t) }
  }, [])
  return (
    <motion.div className="widget glass" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}>
      <div className="w-sub">Desempenho</div>
      <div className="bar"><span style={{ width: `${perf ? Math.round(perf.cpuPercent) : 0}%` }} /></div>
      <div className="w-sub small">
        {err ? err : perf ? `CPU ${perf.cpuPercent.toFixed(0)}% · RAM ${(perf.memUsedMb / 1024).toFixed(1)}/${(perf.memTotalMb / 1024).toFixed(0)} GB` : 'Lendo contadores do sistema…'}
      </div>
    </motion.div>
  )
}
