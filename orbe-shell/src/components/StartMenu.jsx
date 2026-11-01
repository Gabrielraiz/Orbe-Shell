import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useShellStore } from '../store/shellStore'
import { APPS, ALL_APPS } from '../lib/apps'
import { Icon } from './icons/Icons'
import { AppIcon } from './AppIcon'

// Menu Iniciar adaptável: modos compacto / completo / inteligente,
// pesquisa integrada, favoritos, widgets e transições animadas.
export function StartMenu() {
  const open = useShellStore((s) => s.startOpen)
  const close = useShellStore((s) => s.closeStart)
  const mode = useShellStore((s) => s.startMode)
  const setMode = useShellStore((s) => s.setStartMode)
  const openApp = useShellStore((s) => s.openApp)
  const shellMode = useShellStore((s) => s.mode)
  const [q, setQ] = useState('')

  const inputRef = useRef(null)
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 120); else setQ('') }, [open])

  const results = useMemo(() => {
    const base = q ? ALL_APPS.filter((a) => a.name.toLowerCase().includes(q.toLowerCase())) : null
    return base
  }, [q])

  const favorites = shellMode === 'gamer' ? ['gamepad', 'music', 'edge', 'studio'] : shellMode === 'work' ? ['editor', 'notes', 'mail', 'calendar'] : ['explorer', 'edge', 'settings', 'studio']
  const recent = ['studio', 'terminal', 'photos', 'notes']

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
                      {favorites.map((id) => {
                        const a = APPS[id]
                        return (
                          <button key={id} className="start-tile" onClick={() => { openApp(id); close() }}>
                            <AppIcon app={a} size={mode === 'smart' ? 42 : 38} radius={12} />
                            <span>{a.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )}
                {mode === 'full' && (
                  <section>
                    <h4>Recentes</h4>
                    <div className="start-list">
                      {recent.map((id) => (
                        <button key={id} className="start-row" onClick={() => { openApp(id); close() }}>
                          <AppIcon app={APPS[id]} size={26} radius={7} /><span>{APPS[id].name}</span>
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
              <button className="foot-user"><span className="avatar">O</span>Usuário Orbe</button>
              <div className="foot-actions">
                <button title="Bloquear" onClick={() => { close(); useShellStore.getState().pushContinuity('Sessão bloqueada (protótipo).') }}><Icon name="lock" size={16} /></button>
                <button title="Suspender" onClick={() => { close(); useShellStore.getState().emergencyRecovery() }}><Icon name="power" size={16} /></button>
              </div>
            </footer>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
