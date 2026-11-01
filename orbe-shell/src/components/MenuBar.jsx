import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Icon } from './icons/Icons'
import { useShellStore } from '../store/shellStore'
import * as native from '../lib/native'

// Barra superior estilo macOS com menu do Orbe à esquerda e status real à direita.
export function MenuBar() {
  const [now, setNow] = useState(() => new Date())
  const [power, setPower] = useState(null)
  const [audio, setAudio] = useState(null)
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 15)
    return () => clearInterval(t)
  }, [])
  // Status REAL: bateria e volume vêm do backend nativo (GetSystemPowerStatus / Endpoint Volume API)
  useEffect(() => {
    if (!native.IS_TAURI) return
    let alive = true
    const poll = async () => {
      try { const b = await native.batteryInfo(); if (alive) setPower(b) } catch { /* sem info de energia */ }
      try { const a = await native.audioState(); if (alive) setAudio(a) } catch { /* dispositivo ausente */ }
    }
    poll()
    const t = setInterval(poll, 30000)
    return () => { alive = false; clearInterval(t) }
  }, [])
  const toggleStart = useShellStore((s) => s.toggleStart)

  const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const date = now.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <motion.div className="menubar glass" initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
      <button className="mb-orbe" onClick={toggleStart}><span className="orbe-core small" /></button>
      <span className="mb-item bold">Orbe Shell</span>
      <div className="mb-right">
        {power?.hasBattery && (
          <span className="mb-item" title={power.charging ? `Bateria ${power.percent}% — carregando` : `Bateria ${power.percent}%`}>
            <Icon name="battery" size={18} color="rgba(255,255,255,.75)" />
            <span className="mb-batt-num">{power.percent}%{power.charging ? ' ⚡' : ''}</span>
          </span>
        )}
        {audio?.available && (
          <span className="mb-item" title={audio.muted ? 'Saída silenciada' : `Volume ${audio.percent}%`}>
            <Icon name="volume" size={15} color={audio.muted ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.75)'} />
          </span>
        )}
        <span className="mb-item">{date}</span>
        <span className="mb-item bold">{time}</span>
      </div>
    </motion.div>
  )
}
