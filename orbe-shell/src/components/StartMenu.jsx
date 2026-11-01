import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useShellStore } from '../store/shellStore'
import { findAppById, allApps, internalApp } from '../lib/apps'
import { Icon } from './icons/Icons'
import { AppIcon } from './AppIcon'

// Menu Iniciar adaptável: modos compacto / completo / inteligente,
// pesquisa integrada (apps reais do SO + ferramentas internas), favoritos,
// recentes reais e transições animadas.
export function StartMenu() {
  const open = useShellStore((s) => s.startOpen)
  const close = useShellStore((s) => s.closeStart)
  const mode = useShellStore((s) => s.startMode)
  const setMode = useShellStore((s) => s.setStartMode)
  const openApp = useShellStore((s) => s.openApp)
  const shellMode = useShellStore((s) => s.mode)
  const nativeApps = useShellStore((s) => s.nativeApps)
  const windows = useShellStore((s) => s.windows)
  const [q, setQ] = useState('')

  const inputRef = useRef(null)
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 120)
      return () => clearTimeout(t)
    }
  }, [open])

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return null
    return allApps(nativeApps).filter((a) => a.name.toLowerCase().includes(term)).slice(0, 40)
  }, [q, nativeApps])

  // Favoritos por perfil — apenas aplicativos que realmente existem
  const favIds = shellMode === 'gamer' ? ['terminal', 'tasks', 'notes', 'studio'] : shellMode === 'work' ? ['files', 'notes', 'calculator', 'settings'] : ['files', 'terminal', 'tasks', 'settings']
  const favorites = [...nativeApps.slice(0, 8), ...favIds.map((id) => internalApp(id))].filter(Boolean)
    .slice(0, 12)
  // Recentes reais: apps abertos nesta sessão (janelas vivas ou minimizadas)
  const recent = [...new Set(windows.map((w) => w.appId))].map((id) => findAppById(id, nativeApps)).filter(Boolean).slice(0, 6)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
          <motion.div
            className={`start glass-strong ${mode}`}
            initial={{ opacity: 0, y: 46, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 34, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            <div className="start-search">
              <Icon name="search" size={16} color="rgba(255,255,255,.6)" />
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar aplicativos, arquivos e configurações…" />
              <div className="start-modes">
                {[['compact', 'Compacto'], ['full', 'Completo'], ['smart', 'Inteligente']].map(([m, label]) => (
                  <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{label}</button>
                ))}
              </div>
            </div>

            {results ? (
              <div className="start-results">
                {results.length === 0 && <div className="start-empty">Nada encontrado para “{q}”.</div>}
                {results.map((a) => (
                  <button key={a.id} className="start-row" onClick={() => { openApp(a.id); close() }}>
                    <AppIcon app={a} size={30} radius={8} /><span>{a.name}</span>
                    <Icon name="chevron" size={14} color="rgba(255,255,255,.35)" />
                  </button>
                ))}
              </div>
            ) : (
              <>
                {mode !== 'compact' && (
                  <section>
                    <h4>Favoritos</h4>
                    <div className="start-grid">
                      {favorites.map((a) => (
                        <button key={a.id} className="start-tile" onClick={() => { openApp(a.id); close() }}>
                          <AppIcon app={a} size={mode === 'smart' ? 42 : 38} radius={12} />
                          <span>{a.name}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                {mode === 'full' && recent.length > 0 && (
                  <section>
                    <h4>Recentes</h4>
                    <div className="start-list">
                      {recent.map((a) => (
                        <button key={a.id} className="start-row" onClick={() => { openApp(a.id); close() }}>
                          <AppIcon app={a} size={26} radius={7} /><span>{a.name}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                {mode === 'smart' && (
                  <section>
                    <h4>Sugestões inteligentes · perfil {shellMode === 'gamer' ? 'Gamer' : shellMode === 'work' ? 'Trabalho' : 'Inteligente'}</h4>
                    <div className="start-hero glass">
                      <div>
                        <strong>Bom uso contínuo.</strong>
                        <p>O Orbe reorganizou seus favoritos conforme o contexto atual. Alterne perfis no painel de modos ou no Studio.</p>
                      </div>
                      <button className="pill" onClick={() => { openApp('studio'); close() }}>Abrir Studio</button>
                    </div>
                  </section>
                )}
              </>
            )}

            <footer className="start-foot">
              <button className="foot-user" onClick={() => { openApp('settings'); close() }}><span className="avatar">O</span>Configurações do Sistema</button>
              <div className="foot-actions">
                <button title="Bloquear tela (Windows+L)" onClick={() => { close(); useShellStore.getState().lockWorkstation() }}><Icon name="lock" size={16} /></button>
                <button title="Recuperação de emergência" onClick={() => { close(); useShellStore.getState().emergencyRecovery() }}><Icon name="power" size={16} /></button>
              </div>
            </footer>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
