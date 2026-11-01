import { useEffect, useRef, useState } from 'react'
import { motion, useAnimationControls, AnimatePresence } from 'framer-motion'
import { useShellStore } from '../store/shellStore'
import { APPS } from '../lib/apps'
import { Icon } from './icons/Icons'
import { AppIcon } from './AppIcon'

// Conteúdo simulado dos aplicativos (protótipo)
function AppBody({ appId, win }) {
  switch (appId) {
    case 'studio': return <StudioPanel />
    case 'settings': return <SettingsPanel />
    case 'update': return <UpdatePanel />
    case 'continuity': return <ContinuityPanel />
    case 'terminal': return <TerminalPanel />
    case 'calculator': return <CalcPanel />
    case 'notes': return <NotesPanel />
    case 'about': return <AboutPanel />
    default: return <GenericPanel app={APPS[appId]} />
  }
}

function GenericPanel({ app }) {
  const lines = ['Documentos recentes', 'Área de trabalho sincronizada', 'Widgets disponíveis no Studio']
  return (
    <div className="body-pad">
      <div className="fake-toolbar"><span className="fake-btn" /><span className="fake-btn wide" /><span className="fake-btn" /></div>
      <h3 style={{ margin: '14px 0 6px' }}>{app.name}</h3>
      <p className="muted">Este é um conteúdo de demonstração do shell. Em produção, janelas reais de aplicativos Win32/UWP serão integradas via Orbe Window Bridge, respeitando as limitações de cada programa.</p>
      <ul className="fake-list">{lines.map((l) => <li key={l}><span className="fake-bullet" />{l}</li>)}</ul>
    </div>
  )
}

function CalcPanel() {
  const [v, setV] = useState('0')
  const press = (k) => {
    if (k === 'C') return setV('0')
    if (k === '=') { try { setV(String(Function(`return (${v.replace(/×/g, '*').replace(/÷/g, '/')})`)())) } catch { setV('Erro') } return }
    setV(v === '0' || /Erro/.test(v) ? k : v + k)
  }
  const keys = ['C', '÷', '×', '⌫', '7', '8', '9', '-', '4', '5', '6', '+', '1', '2', '3', '=', '0', '.', '(', ')']
  return (
    <div className="calc">
      <div className="calc-out">{v}</div>
      <div className="calc-keys">{keys.map((k) => <button key={k} onClick={() => press(k)}>{k}</button>)}</div>
    </div>
  )
}

function NotesPanel() {
  const [text, setText] = useState(localStorage.getItem('orbe-note') || 'Bem-vindo ao Orbe Shell ✦\n\nAnote suas ideias aqui.')
  useEffect(() => { const t = setTimeout(() => localStorage.setItem('orbe-note', text), 300); return () => clearTimeout(t) }, [text])
  return <div className="body-pad"><textarea className="note-area" value={text} onChange={(e) => setText(e.target.value)} /></div>
}

function TerminalPanel() {
  const [hist, setHist] = useState(['Orbe Shell 0.4 (prototype) — digite "help".'])
  const [cmd, setCmd] = useState('')
  const run = () => {
    const out = [...hist, `❯ ${cmd}`]
    const c = cmd.trim().toLowerCase()
    if (c === 'help') out.push('comandos: help, neofetch, ls, echo <texto>, clear, exit')
    else if (c.startsWith('echo')) out.push(cmd.slice(5))
    else if (c === 'ls') out.push('Documentos  Imagens  Projetos  Downloads')
    else if (c === 'neofetch') out.push('     ◍◍     Usuário@ORBE\n  ◍    ◍   ----------------\n  ◍    ◍   SO: Windows 11 + Orbe Shell\n     ◍◍     Kernel: NT 10.0 · Shell: orbe 0.4\n             UI: Liquid Glass · FPS alvo: 120')
    else if (c === 'clear') { setHist(['']); setCmd(''); return }
    else if (c === 'exit') out.push('Encerrar? Use o botão ✕ da janela.')
    else if (c) out.push(`orbe: comando não reconhecido: ${c}`)
    setHist(out); setCmd('')
  }
  return (
    <div className="term" onClick={() => document.getElementById('term-in')?.focus()}>
      {hist.map((l, i) => <div key={i} className="term-line">{l}</div>)}
      <input id="term-in" value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} spellCheck={false} autoFocus />
    </div>
  )
}

// ── Painéis do próprio shell ───────────────────────────────────────
export function StudioPanel() { return <OrbeStudio embedded /> }

function SettingsPanel() {
  const s = useShellStore()
  return (
    <div className="body-pad settings">
      <h3>Sistema</h3>
      <div className="set-row"><span>Perfil ativo</span>
        <div className="seg">{[['work', 'Trabalho'], ['gamer', 'Gamer'], ['smart', 'Inteligente']].map(([m, l]) => <button key={m} className={s.mode === m ? 'on' : ''} onClick={() => s.setMode(m)}>{l}</button>)}</div></div>
      <div className="set-row"><span>Reduzir efeitos (desempenho)</span><Switch on={s.reduceFx} onChange={s.setReduceFx} /></div>
      <div className="set-row"><span>Mostrar ícones na área de trabalho</span><Switch on={s.showDesktopIcons} onChange={s.setShowDesktopIcons} /></div>
      <h3>Canal de atualização</h3>
      <div className="set-row"><span>Orbe Update Center</span><button className="pill" onClick={() => s.openApp('update')}>Abrir</button></div>
      <h3>Segurança</h3>
      <p className="muted">Permissões controladas por componente. O Orbe nunca substitui processos críticos sem fallback para o Explorer nativo.</p>
    </div>
  )
}

function UpdatePanel() {
  const [channel, setChannel] = useState('stable')
  const [state, setState] = useState('idle') // idle | checking | ready | installing | done
  const check = () => { setState('checking'); setTimeout(() => setState('ready'), 1400) }
  const install = () => { setState('installing'); setTimeout(() => setState('done'), 2200) }
  return (
    <div className="body-pad update">
      <h3>Orbe Update Center</h3>
      <div className="chans">{[['stable', 'Estável'], ['beta', 'Beta'], ['exp', 'Experimental']].map(([c, l]) => <button key={c} className={`chan ${channel === c ? 'on' : ''}`} onClick={() => setChannel(c)}>{l}<small>{c === 'stable' ? 'Verificado' : c === 'beta' ? 'Semanal' : 'Diário'}</small></button>)}</div>
      <div className="upd-card glass">
        {state === 'idle' && <p>Versão instalada: <b>Orbe Shell 0.4.0-prototype</b> · canal {channel}. Clique em verificar para procurar atualizações.</p>}
        {state === 'checking' && <p className="muted">Procurando atualizações…</p>}
        {state === 'ready' && <><p><b>Orbe Shell 0.4.1</b> disponível.</p><p className="muted">Você será avisado antes da instalação. Esta versão pode ser revertida pelo histórico.</p><button className="pill" onClick={install}>Baixar e instalar</button></>}
        {state === 'installing' && <><div className="prog"><motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 2 }} /></div><p className="muted">Instalando…</p></>}
        {state === 'done' && <><p>✔ Instalação concluída. Reinicie o shell para aplicar.</p><button className="pill ghost" onClick={() => setState('idle')}>Reverter para 0.4.0</button></>}
      </div>
      <div className="upd-actions">{state === 'idle' && <button className="pill" onClick={check}>Verificar atualizações</button>}</div>
    </div>
  )
}

function ContinuityPanel() {
  const log = useShellStore((s) => s.continuityLog)
  const push = useShellStore((s) => s.pushContinuity)
  const recover = useShellStore((s) => s.emergencyRecovery)
  return (
    <div className="body-pad">
      <h3>Orbe Continuity</h3>
      <p className="muted">Monitora componentes do shell. Se um widget ou painel falhar, o Orbe tenta restaurá-lo sem perder o estado da interface — recorrendo ao desktop nativo do Windows apenas quando necessário.</p>
      <div className="cont-grid">
        <button className="pill" onClick={() => push('Verificação de saúde executada — todos os módulos OK.')}>Executar verificação</button>
        <button className="pill warn" onClick={() => push('Falha simulada detectada no widget Clima → restaurado automaticamente.')}>Simular falha de widget</button>
        <button className="pill danger" onClick={recover}>Recuperação de emergência</button>
      </div>
      <div className="cont-log">
        {log.length === 0 && <div className="muted">Nenhum evento registrado.</div>}
        {log.slice().reverse().map((e, i) => <div key={i} className="cont-ev"><span className="cont-time">{new Date(e.t).toLocaleTimeString('pt-BR')}</span>{e.msg}</div>)}
      </div>
    </div>
  )
}

function AboutPanel() {
  return (
    <div className="body-pad about">
      <div className="about-orbe"><span className="orbe-core big" /></div>
      <h2>Orbe Shell</h2>
      <p className="muted">Protótipo 0.4 · experiência de desktop premium para Windows</p>
      <p>Beleza, fluidez, desempenho, inteligência e liberdade de personalização funcionando juntos.</p>
    </div>
  )
}

function Switch({ on, onChange }) {
  return <button className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)}><span /></button>
}

// ── Janela genérica com arrasto, redimensionamento, snap e Genie ───
export function Window({ win }) {
  const app = APPS[win.appId] || { name: win.appId, color1: '#666', color2: '#333', glyph: 'orb' }
  const focused = useShellStore((s) => s.focused === win.id)
  const store = useShellStore.getState()
  const ref = useRef(null)
  const controls = useAnimationControls()
  const [snapHint, setSnapHint] = useState(null)

  // Geometria efetiva (maximizado vs normal)
  const geo = win.maximized
    ? { left: 8, top: 40, width: window.innerWidth - 16, height: window.innerHeight - 120 }
    : { left: win.x, top: win.y, width: win.w, height: win.h }

  const startDrag = (e) => {
    if (e.button !== 0) return
    store.focusWindow(win.id)
    const sx = e.clientX - win.x, sy = e.clientY - win.y
    let raf
    const move = (ev) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const x = ev.clientX - sx, y = Math.max(36, ev.clientY - sy)
        store.moveWindow(win.id, x, y)
        // Zona de encaixe
        const vw = window.innerWidth, vh = window.innerHeight
        let z = null
        if (ev.clientY < 60) z = ev.clientX < vw * 0.25 ? 'tl' : ev.clientX > vw * 0.75 ? 'tr' : 'top'
        else if (ev.clientX < 40) z = ev.clientY < vh / 2 ? 'left' : 'left'
        else if (ev.clientX > vw - 40) z = 'right'
        if (z !== snapHint) { setSnapHint(z); store.setSnapping(win.id, z) }
      })
    }
    const up = (ev) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (snapHint) store.snapWindow(win.id, snapHint)
      setSnapHint(null); store.setSnapping(win.id, null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const startResize = (e) => {
    e.stopPropagation()
    store.focusWindow(win.id)
    const sw = win.w, sh = win.h, sx = e.clientX, sy = e.clientY
    const move = (ev) => {
      store.resizeWindow(win.id, Math.max(360, sw + ev.clientX - sx), Math.max(240, sh + ev.clientY - sy))
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const genieMinimize = () => {
    if (useShellStore.getState().reduceFx) { store.minimizeWindow(win.id); return }
    const rect = ref.current.getBoundingClientRect()
    const targetX = window.innerWidth / 2
    store.genieMinimize(win.id, targetX)
    // Genie: a janela é "sugada" em direção ao dock com deformação progressiva.
    // Combinamos translate + scale + skew e suavizamos o deslocamento vertical
    // com uma curva de aceleração crescente (o efeito fica mais intenso perto do dock).
    controls.start({
      scaleX: 0.03, scaleY: 0.06, x: targetX - (rect.left + rect.width / 2), y: window.innerHeight - 40 - (rect.top + rect.height / 2),
      opacity: [1, 1, 0.85], skewX: [0, -8, 10],
      transition: { duration: 0.5 / useShellStore.getState().animSpeed, ease: [0.4, 0.1, 0.3, 1] },
    }).then(() => store.finishGenie(win.id))
  }

  useEffect(() => {
    if (!win.genie) controls.start({ scaleX: 1, scaleY: 1, x: 0, y: 0, skewX: 0, opacity: 1, transition: { type: 'spring', stiffness: 320, damping: 26 } })
  }, [win.minimized, win.genie])

  return (
    <AnimatePresence>
      {!win.minimized && (
        <motion.div
          ref={ref}
          className={`window glass-strong ${focused ? 'focused' : ''}`}
          animate={controls}
          initial={{ opacity: 0, scale: 0.92, y: 24 }}
          exit={{ opacity: 0, scale: 0.94, y: 16, transition: { duration: 0.16 } }}
          transition={{ type: 'spring', stiffness: 340, damping: 28 }}
          style={{ ...geo, zIndex: win.z, transformOrigin: `${win.genieTargetX}px bottom` }}
          onPointerDown={() => !focused && store.focusWindow(win.id)}
        >
          {win.snapping && <div className={`snap-preview sp-${win.snapping}`} />}
          <div className="win-head" onPointerDown={startDrag} onDoubleClick={genieMinimize}>
            <div className="win-title">
              <AppIcon app={app} size={20} radius={6} />
              <span>{app.name}</span>
            </div>
            <div className="win-btns">
              <button title="Minimizar (Genie)" onClick={genieMinimize}><Icon name="min" size={13} /></button>
              <button title="Maximizar" onClick={() => store.toggleMaximize(win.id)}><Icon name={win.maximized ? 'restore' : 'max'} size={12} /></button>
              <button className="close" title="Fechar" onClick={() => store.closeWindow(win.id)}><Icon name="close" size={13} /></button>
            </div>
          </div>
          <div className="win-body"><AppBody appId={win.appId} win={win} /></div>
          {!win.maximized && <div className="resize-handle" onPointerDown={startResize} />}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Orbe Studio — central de personalização
export function OrbeStudio({ embedded }) {
  const s = useShellStore()
  const sections = [
    ['Aparência', <Palette key="p" />],
    ['Glass', <GlassCtl key="g" />],
    ['Dock', <DockCtl key="d" />],
    ['Animações', <AnimCtl key="a" />],
    ['Modos', <ModesCtl key="m" />],
    ['Widgets', <WidgetsCtl key="w" />],
  ]
  const [tab, setTab] = useState(0)
  return (
    <div className="studio">
      <nav className="studio-tabs">
        {sections.map(([name], i) => <button key={name} className={tab === i ? 'on' : ''} onClick={() => setTab(i)}>{name}</button>)}
        {!embedded && <button className="close-tab" onClick={s.toggleStudio}><Icon name="close" size={13} /></button>}
      </nav>
      <div className="studio-body">
        <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 32 }}>
          {sections[tab][1]}
        </motion.div>
      </div>
    </div>
  )
}

function Palette() {
  const { wallpaper, setWallpaper } = useShellStore()
  return (
    <div className="ctl">
      <h4>Cores dinâmicas · papel de parede</h4>
      <p className="muted">As cores de destaque do sistema acompanham o papel de parede selecionado.</p>
      <div className="wp-grid">
        {WALL_LIST.map((w) => (
          <button key={w.id} className={`wp-thumb ${wallpaper === w.id ? 'on' : ''}`} style={{ background: w.css }} onClick={() => setWallpaper(w.id)}>
            <span>{w.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

import { WALLPAPERS as WALL_LIST } from '../lib/wallpapers'

function Slider({ label, value, min, max, step = 1, fmt, onChange }) {
  return (
    <label className="slider">
      <span>{label}<b>{fmt ? fmt(value) : value}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  )
}

function GlassCtl() {
  const s = useShellStore()
  return (
    <div className="ctl">
      <h4>Liquid Glass</h4>
      <Slider label="Transparência" value={s.opacity} min={0.3} max={0.95} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} onChange={s.setOpacity} />
      <Slider label="Desfoque" value={s.blur} min={0} max={48} fmt={(v) => `${v}px`} onChange={s.setBlur} />
      <div className="row2"><span>Reduzir efeitos (economia de GPU)</span><Switch on={s.reduceFx} onChange={s.setReduceFx} /></div>
    </div>
  )
}

function DockCtl() {
  const s = useShellStore()
  return (
    <div className="ctl">
      <h4>Dock</h4>
      <Slider label="Tamanho dos ícones" value={s.dockSize} min={36} max={72} fmt={(v) => `${v}px`} onChange={s.setDockSize} />
      <div className="row2"><span>Ampliação ao passar o mouse</span><Switch on={s.dockMagnify} onChange={s.setDockMagnify} /></div>
      <div className="row2"><span>Ocultação automática</span><Switch on={s.autoHideDock} onChange={s.setAutoHideDock} /></div>
      <p className="muted">Arraste os ícones do dock para reordenar. Botão direito oferece o menu completo.</p>
    </div>
  )
}

function AnimCtl() {
  const s = useShellStore()
  return (
    <div className="ctl">
      <h4>Animações</h4>
      <Slider label="Velocidade global" value={s.animSpeed} min={0.5} max={2} step={0.1} fmt={(v) => `${v.toFixed(1)}×`} onChange={s.setAnimSpeed} />
      <p className="muted">Movimentos tipo mola e minimização estilo Genie usam esta curva como base. Transições: spring suave (recomendado).</p>
    </div>
  )
}

function ModesCtl() {
  const s = useShellStore()
  const modes = [['work', 'Trabalho', 'Foco, produtividade e apps de escrita'], ['gamer', 'Gamer', 'Dock limpo, jogos e mídia em destaque'], ['smart', 'Inteligente', 'O Orbe decide conforme contexto e horários']]
  return (
    <div className="ctl">
      <h4>Modos inteligentes</h4>
      <div className="mode-cards">
        {modes.map(([id, name, desc]) => (
          <button key={id} className={`mode-card ${s.mode === id ? 'on' : ''}`} onClick={() => s.setMode(id)}>
            <strong>{name}</strong><span>{desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function WidgetsCtl() {
  const s = useShellStore()
  const list = [['clock', 'Relógio grande'], ['weather', 'Clima'], ['music', 'Player de música'], ['monitor', 'Monitor de desempenho']]
  return (
    <div className="ctl">
      <h4>Widgets da área de trabalho</h4>
      {list.map(([k, l]) => <div className="row2" key={k}><span>{l}</span><Switch on={s.widgets[k]} onChange={() => s.toggleWidget(k)} /></div>)}
    </div>
  )
}
