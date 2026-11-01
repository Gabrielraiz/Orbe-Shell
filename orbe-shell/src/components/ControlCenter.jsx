import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useShellStore } from '../store/shellStore'
import { findAppById } from '../lib/apps'
import * as native from '../lib/native'
import { Icon } from './icons/Icons'

// Volume REAL do sistema (Endpoint Volume API via backend Rust).
function VolumeSlider() {
  const [audio, setAudio] = useState(null)
  const [err, setErr] = useState(null)
  useEffect(() => {
    if (!native.IS_TAURI) { setErr('Volume disponível apenas no app nativo.'); return }
    let alive = true
    native.audioState().then((a) => { if (alive) setAudio(a) }).catch((e) => setErr(String(e)))
    return () => { alive = false }
  }, [])
  const apply = async (pct) => {
    try { const a = await native.audioSetVolume(pct); setAudio(a) } catch (e) { setErr(String(e)) }
  }
  const mute = async () => {
    try { const a = await native.audioToggleMute(); setAudio(a) } catch (e) { setErr(String(e)) }
  }
  return (
    <div className="cc-volume">
      <button className={`cc-vol-btn ${audio?.muted ? 'on' : ''}`} title={audio?.muted ? 'Ativar som' : 'Silenciar'} onClick={mute}>
        <Icon name="volume" size={15} style={audio?.muted ? { opacity: 0.4 } : undefined} />
      </button>
      {audio
        ? <input type="range" min="0" max="100" value={audio.percent} onChange={(e) => apply(Number(e.target.value))} />
        : <span className="muted">{err || 'Lendo volume…'}</span>}
      {audio && <span className="cc-vol-num">{audio.muted ? 0 : audio.percent}%</span>}
    </div>
  )
}

// Central de controle + seletor de áreas de trabalho (Mission Control leve)
export function TopWidgets() {
  const [panel, setPanel] = useState(false)
  const [expose, setExpose] = useState(false)
  const nativeApps = useShellStore((s) => s.nativeApps)
  const desktops = useShellStore((s) => s.desktops)
  const current = useShellStore((s) => s.currentDesktop)
  const switchD = useShellStore((s) => s.switchDesktop)
  const addD = useShellStore((s) => s.addDesktop)
  const windows = useShellStore((s) => s.windows)
  const mode = useShellStore((s) => s.mode)
  const setMode = useShellStore((s) => s.setMode)
  const openApp = useShellStore((s) => s.openApp)

  return (
    <>
      <div className="desk-pill glass">
        <button className="dp-btn" title="Áreas de trabalho" onClick={() => setExpose(true)}><Icon name="layers" size={14} /></button>
        <span className="dp-sep" />
        {desktops.map((d, i) => (
          <button key={i} className={`dp-desk ${current === i ? 'on' : ''}`} onClick={() => switchD(i)}>{d}</button>
        ))}
        <button className="dp-btn" onClick={addD} title="Nova área"><Icon name="plus" size={13} /></button>
        <span className="dp-sep" />
        <button className="dp-btn" title="Central de controle" onClick={() => setPanel(!panel)}><Icon name="sliders" size={14} /></button>
      </div>

      <AnimatePresence>
        {panel && (
          <motion.div className="cc glass-strong" initial={{ opacity: 0, y: -16, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.96 }} transition={{ type: 'spring', stiffness: 420, damping: 30 }}>
            <div className="cc-grid">
              {[['Wi-Fi', 'wifi', true], ['Bluetooth', 'sparkle', false], ['Tela', 'sun', true], ['Não perturbe', 'moon', mode === 'gamer']].map(([t, ic, on]) => (
                <button key={t} className={`cc-tile ${on ? 'on' : ''}`}><Icon name={ic} size={16} /><span>{t}</span></button>
              ))}
            </div>
            <VolumeSlider />
            <div className="cc-modes">
              {[['work', 'Trabalho'], ['gamer', 'Gamer'], ['smart', 'Inteligente']].map(([m, l]) => (
                <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{l}</button>
              ))}
            </div>
            <button className="cc-studio pill" onClick={() => { openApp('studio'); setPanel(false) }}>Orbe Studio</button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {expose && (
          <motion.div className="expose scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setExpose(false)}>
            <motion.div className="expose-inner" initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }} onClick={(e) => e.stopPropagation()}>
              <h3>Áreas de trabalho</h3>
              <div className="expose-desks">
                {desktops.map((d, i) => (
                  <button key={i} className={`edesk ${current === i ? 'on' : ''}`} onClick={() => { switchD(i); setExpose(false) }}>
                    <span className="edesk-prev glass">{windows.filter((w) => w.desktop === i).slice(0, 3).map((w) => <i key={w.id} />)}</span>
                    {d}
                  </button>
                ))}
                <button className="edesk add" onClick={addD}><Icon name="plus" size={20} /></button>
              </div>
              <h3>Janelas abertas</h3>
              <div className="expose-wins">
                {windows.length === 0 && <div className="muted">Nenhuma janela aberta.</div>}
                {windows.map((w) => (
                  <button key={w.id} className="ewin glass" onClick={() => { useShellStore.getState().focusWindow(w.id); if (w.minimized) useShellStore.getState().openApp(w.appId); setExpose(false) }}>
                    {findAppById(w.appId, nativeApps)?.name || w.appId}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
