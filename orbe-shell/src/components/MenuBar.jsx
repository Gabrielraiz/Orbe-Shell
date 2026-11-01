import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Icon } from './icons/Icons'
import { useShellStore } from '../store/shellStore'

// Barra superior estilo macOS com menu do Orbe à esquerda e relógio à direita.
export function MenuBar() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 15)
    return () => clearInterval(t)
  }, [])
  const toggleStart = useShellStore((s) => s.toggleStart)

  const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const date = now.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <motion.div className="menubar glass" initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
      <button className="mb-orbe" onClick={toggleStart}><span className="orbe-core small" /></button>
      <span className="mb-item bold">Orbe Shell</span>
      <span className="mb-item">Arquivo</span>
      <span className="mb-item">Edição</span>
      <span className="mb-item">Janela</span>
      <span className="mb-item">Ajuda</span>
      <div className="mb-right">
        <Icon name="wifi" size={15} color="rgba(255,255,255,.75)" />
        <Icon name="battery" size={18} color="rgba(255,255,255,.75)" />
        <Icon name="volume" size={15} color="rgba(255,255,255,.75)" />
        <span className="mb-item">{date}</span>
        <span className="mb-item bold">{time}</span>
      </div>
    </motion.div>
  )
}
