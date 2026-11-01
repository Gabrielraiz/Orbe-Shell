import { useEffect, useRef, useState } from 'react'
import { motion, useAnimationControls, AnimatePresence } from 'framer-motion'
import { useShellStore } from '../store/shellStore'
import { findAppById, internalApp, VERSION, cmpVer } from '../lib/apps'
import * as native from '../lib/native'
import { Icon } from './icons/Icons'
import { AppIcon } from './AppIcon'

// Conteúdo dos aplicativos. Cada painel aqui é código real e funcional:
// ferramentas internas do shell (arquivos, processos, notas em disco, volume,
// atualizações verificadas no registro público) — nada de dados inventados.
function AppBody({ appId }) {
  switch (appId) {
    case 'studio': return <StudioPanel />
    case 'settings': return <SettingsPanel />
    case 'update': return <UpdatePanel />
    case 'continuity': return <ContinuityPanel />
    case 'terminal': return <TerminalPanel />
    case 'calculator': return <CalcPanel />
    case 'notes': return <NotesPanel />
    case 'files': return <FilesPanel />
    case 'tasks': return <TasksPanel />
    case 'about': return <AboutPanel />
    default: return <MissingPanel appId={appId} />
  }
}

function MissingPanel({ appId }) {
  return (
    <div className="body-pad">
      <h3>Conteúdo indisponível</h3>
      <p className="muted">Não existe um módulo real para “{appId}”. O Orbe Shell não exibe conteúdo de demonstração: abra uma ferramenta listada no Menu ou no Dock.</p>
    </div>
  )
}

// ── Explorador de Arquivos REAL (backend Rust, restrito à pasta do usuário) ──
const fmtSize = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : b < 1073741824 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1073741824).toFixed(2)} GB`)

function FilesPanel() {
  const push = useShellStore((s) => s.pushContinuity)
  const [cwd, setCwd] = useState('')
  const [entries, setEntries] = useState(null)
  const [err, setErr] = useState(null)
  const [view, setView] = useState(null) // {path, name, text} | {path, name, text, editing}
  const [busy, setBusy] = useState(false)

  const go = async (p) => {
    if (!native.IS_TAURI) { setErr('O Explorador exige o app nativo. Rode com "npm run tauri:dev".'); return }
    setBusy(true); setErr(null)
    try {
      const list = await native.readDir(p)
      setCwd(p); setEntries(list)
    } catch (e) { setErr(String(e)) }
    setBusy(false)
  }

  useEffect(() => {
    if (!entries && !err) { const t = setTimeout(() => go(''), 0); return () => clearTimeout(t) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openEntry = async (en) => {
    if (en.isDir) return go(en.path)
    try {
      const text = await native.readFile(en.path)
      setView({ path: en.path, name: en.name, text, editing: false })
    } catch (e) { setErr(String(e)) }
  }

  const save = async () => {
    try {
      await native.writeFile(view.path, view.text)
      setView({ ...view, editing: false })
      push(`Arquivo salvo: ${view.name}`)
    } catch (e) { setErr(String(e)) }
  }

  const del = async (en) => {
    try {
      const msg = await native.deleteEntry(en.path)
      push(msg); go(cwd)
    } catch (e) { setErr(String(e)) }
  }

  if (view) {
    return (
      <div className="files">
        <div className="files-bar">
          <button className="pill ghost" onClick={() => setView(null)}>Voltar</button>
          <span className="files-path">{view.name}</span>
          {view.editing
            ? <><button className="pill" onClick={save}>Salvar</button><button className="pill ghost" onClick={() => setView({ ...view, editing: false })}>Cancelar</button></>
            : <button className="pill" onClick={() => setView({ ...view, editing: true })}>Editar</button>}
        </div>
        {err && <div className="panel-err">{err}</div>}
        {view.editing
          ? <textarea className="files-edit" value={view.text} onChange={(e) => setView({ ...view, text: e.target.value })} spellCheck={false} />
          : <pre className="files-view">{view.text}</pre>}
      </div>
    )
  }

  return (
    <div className="files">
      <div className="files-bar">
        <button className="pill ghost" title="Subir um nível" disabled={!cwd}
          onClick={() => { const up = cwd.replace(/[\\/][^\\/]*$/, ''); go(up || '') }}>
          <Icon name="chevron" size={12} /> Voltar
        </button>
        <span className="files-path">{cwd || 'Pasta do usuário'}</span>
        <button className="pill ghost" onClick={() => go(cwd)}><Icon name="refresh" size={12} /></button>
      </div>
      {err && <div className="panel-err">{err}</div>}
      {busy && <div className="muted pad">Lendo pasta…</div>}
      {!busy && entries && (
        <div className="files-list">
          {entries.length === 0 && <div className="muted pad">Pasta vazia.</div>}
          {entries.map((en) => (
            <div key={en.path} className="file-row" onDoubleClick={() => openEntry(en)}
              onContextMenu={(e) => { e.preventDefault(); if (!en.isDir) del(en) }}>
              <Icon name={en.isDir ? 'folder' : 'note'} size={15} color="rgba(255,255,255,.7)" />
              <span className="fname">{en.name}</span>
              <span className="fsize">{en.isDir ? '' : fmtSize(en.size)}</span>
              <button className="fopen pill ghost" onClick={() => openEntry(en)}>Abrir</button>
            </div>
          ))}
        </div>
      )}
      {!native.IS_TAURI && <div className="muted pad">Visualização de arquivos disponível apenas no aplicativo nativo.</div>}
    </div>
  )
}

// ── Gerenciador de Tarefas REAL (list_processes / end_process via Rust) ──
function TasksPanel() {
  const push = useShellStore((s) => s.pushContinuity)
  const [procs, setProcs] = useState(null)
  const [err, setErr] = useState(null)
  const [q, setQ] = useState('')
  const [auto, setAuto] = useState(true)

  const refresh = async () => {
    try { setProcs(await native.listProcesses()); setErr(null) }
    catch (e) { setErr(String(e)) }
  }
  useEffect(() => {
    if (!native.IS_TAURI) {
      const t = setTimeout(() => setErr('Gerenciador de tarefas exige o app nativo. Rode com "npm run tauri:dev".'), 0)
      return () => clearTimeout(t)
    }
    // Primeira leitura tambem adiada: setState nunca ocorre sincronamente no efeito.
    let alive = true
    const first = setTimeout(() => { refresh().catch(() => {}) }, 0)
    const timer = auto ? setInterval(() => { if (alive) refresh().catch(() => {}) }, 3000) : null
    return () => { alive = false; clearTimeout(first); if (timer) clearInterval(timer) }
  }, [auto]) // eslint-disable-line react-hooks/exhaustive-deps

  const kill = async (p) => {
    try { const msg = await native.endProcess(p.pid, p.name); push(msg); refresh() }
    catch (e) { push(`Falha ao encerrar: ${e}`) }
  }

  const filtered = (procs || []).filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="tasks">
      <div className="files-bar">
        <input className="task-search" placeholder="Filtrar processos…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="row-inline"><Switch on={auto} onChange={setAuto} /><span>Atualizar</span></label>
        <button className="pill ghost" onClick={refresh}><Icon name="refresh" size={12} /> Agora</button>
      </div>
      {err && <div className="panel-err">{err}</div>}
      {procs && (
        <>
          <div className="task-head"><span>PID</span><span>Processo</span><span>Memória</span><span /></div>
          <div className="task-list">
            {filtered.slice(0, 120).map((p) => (
              <div key={p.pid} className="task-row">
                <span className="tpid">{p.pid}</span>
                <span className="tname">{p.name}</span>
                <span>{p.memMb > 0 ? `${p.memMb.toFixed(1)} MB` : '—'}</span>
                <button className="tkill pill danger" onClick={() => kill(p)}>Encerrar</button>
              </div>
            ))}
            {filtered.length === 0 && <div className="muted pad">Nenhum processo corresponde ao filtro.</div>}
          </div>
        </>
      )}
    </div>
  )
}

// Avaliador de expressões aritméticas seguro (sem eval/Function):
// tokenizer + parser recursivo com precedência. Suporta + - * / ( ) e decimais.
function evalExpr(src) {
  let i = 0
  const s = src.replace(/\s+/g, '')
  // rejeita colagem maliciosa de tokens: "1 2" viraria "12", "2 3" viraria "23"
  if (/\d\s+\d|[a-z]\s+[a-z(]/i.test(src)) throw new Error('espaco')
  const peek = () => s[i]
  const eat = (c) => { if (peek() === c) { i++; return true } return false }
  function parseNum() {
    const start = i
    while (i < s.length && /[0-9.]/.test(s[i])) i++
    if (start === i) throw new Error('num')
    const n = Number(s.slice(start, i))
    if (!Number.isFinite(n)) throw new Error('num')
    return n
  }
  function parseFactor() {
    if (eat('-')) return -parseFactor()
    if (eat('+')) return parseFactor()
    if (eat('(')) { const v = parseExpr(); if (!eat(')')) throw new Error('paren'); return v }
    return parseNum()
  }
  function parseTerm() {
    let v = parseFactor()
    for (;;) {
      const c = peek()
      if (c === '*' || c === '/') { i++; const r = parseFactor(); v = c === '*' ? v * r : v / r }
      else return v
    }
  }
  function parseExpr() {
    let v = parseTerm()
    for (;;) {
      if (eat('+')) v += parseTerm()
      else if (eat('-')) v -= parseTerm()
      else return v
    }
  }
  const out = parseExpr()
  if (i < s.length) throw new Error('fim')
  return out
}

function CalcPanel() {
  const [v, setV] = useState('0')
  const press = (k) => {
    if (k === 'C') return setV('0')
    if (k === '⌫') return setV(v.length > 1 ? v.slice(0, -1) : '0')
    if (k === '=') {
      try {
        const normalized = v.replace(/×/g, '*').replace(/÷/g, '/')
        const r = evalExpr(normalized)
        setV(String(Math.round(r * 1e10) / 1e10))
      } catch { setV('Erro') }
      return
    }
    if (/Erro/.test(v)) return setV(k)
    setV(v === '0' && k !== '.' ? k : v + k)
  }
  const keys = ['C', '÷', '×', '⌫', '7', '8', '9', '-', '4', '5', '6', '+', '1', '2', '3', '=', '0', '.', '(', ')']
  return (
    <div className="calc">
      <div className="calc-out">{v}</div>
      <div className="calc-keys">{keys.map((k) => <button key={k} onClick={() => press(k)}>{k}</button>)}</div>
    </div>
  )
}

// ── Notas REAIS: salvam em arquivo na pasta do usuário (via backend) e
//    usam localStorage como armazenamento honesto no modo web. ──
function NotesPanel() {
  const push = useShellStore((s) => s.pushContinuity)
  const [text, setText] = useState(localStorage.getItem('orbe-note') || '')
  const [status, setStatus] = useState(native.IS_TAURI ? 'Carregando nota do disco…' : 'Salvando localmente (navegador).')
  const notePathRef = useRef(null)

  useEffect(() => {
    let alive = true
    if (!native.IS_TAURI) { const t = setTimeout(() => setStatus('Salvando localmente neste navegador.'), 0); return () => clearTimeout(t) }
    (async () => {
      try {
        const home = (await native.sysInfo()).home
        const path = `${home}${navigator.platform.includes('Win') ? '\\' : '/'}orbe-notes.txt`
        notePathRef.current = path
        const content = await native.readFile(path).catch(() => '')
        if (!alive) return
        if (content) setText(content)
        setStatus(`Nota salva em disco: ${path}`)
      } catch (e) { if (alive) setStatus(`Nota em armazenamento local: ${e}`) }
    })()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem('orbe-note', text)
      if (notePathRef.current) native.writeFile(notePathRef.current, text).catch(() => {})
    }, 400)
    return () => clearTimeout(t)
  }, [text])

  return (
    <div className="body-pad notes">
      <textarea className="note-area" value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva sua nota…" />
      <div className="notes-foot">
        <span className="muted">{status}</span>
        <button className="pill ghost" onClick={() => { setText(''); push('Nota limpa.') }}>Limpar</button>
      </div>
    </div>
  )
}

// ── Console REAL: comandos executados contra o backend nativo ───────
function TerminalPanel() {
  const [hist, setHist] = useState([native.IS_TAURI ? 'Console do Sistema — digite "help".' : 'Console do Sistema (modo web: comandos nativos indisponíveis) — digite "help".'])
  const [cmd, setCmd] = useState('')
  const run = async () => {
    const out = [...hist, `> ${cmd}`]
    const c = cmd.trim().toLowerCase()
    if (c === 'help') out.push('comandos: help, sysinfo, ps, ls [pasta], volume, wallpaper, cat <arquivo>, clear')
    else if (c === 'sysinfo') { try { const i = await native.sysInfo(); out.push(`${i.os} ${i.version}\nHost: ${i.hostname} · ${i.cpus} threads · RAM ${i.ramTotalGb.toFixed(1)} GB\nHome: ${i.home}`) } catch (e) { out.push(String(e)) } }
    else if (c === 'ps') { try { const p = await native.listProcesses(); out.push(p.slice(0, 20).map((x) => `${String(x.pid).padEnd(8)}${x.name.padEnd(28)}${x.memMb.toFixed(1)} MB`).join('\n')) } catch (e) { out.push(String(e)) } }
    else if (c === 'volume') { try { const a = await native.audioState(); out.push(`Volume: ${Math.round(a.volume * 100)}% · ${a.muted ? 'Silenciado' : 'Ativo'} · Dispositivo padrão: ${a.device}`) } catch (e) { out.push(String(e)) } }
    else if (c === 'wallpaper') { try { out.push(await native.currentWallpaper()) } catch (e) { out.push(String(e)) } }
    else if (c.startsWith('ls')) { try { const list = await native.readDir(cmd.slice(2).trim()); out.push(list.map((e) => `${e.isDir ? 'd' : '-'} ${e.name}`).join('\n') || '(vazio)') } catch (e) { out.push(String(e)) } }
    else if (c.startsWith('cat ')) { try { out.push(await native.readFile(cmd.slice(4).trim())) } catch (e) { out.push(String(e)) } }
    else if (c === 'clear') { setHist(['']); setCmd(''); return }
    else if (c) out.push(`Comando não reconhecido: ${c}`)
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

// ── Central de Atualização REAL: consulta o registro público do projeto
//    (via backend) e instala apenas com confirmação explícita do usuário.
//    A comparacao de versoes usa cmpVer() compartilhada (testada em tests/). ──
function UpdatePanel() {
  const push = useShellStore((s) => s.pushContinuity)
  const [channel, setChannel] = useState('stable')
  const [state, setState] = useState('idle') // idle | checking | ready | latest | installing | done | error
  const [remote, setRemote] = useState(null)
  const [err, setErr] = useState(null)
  const [confirmed, setConfirmed] = useState(false)

  const check = async () => {
    if (!native.IS_TAURI) { setErr('A verificação de atualizações exige o app nativo (backend PowerShell).'); setState('error'); return }
    setState('checking'); setErr(null); setRemote(null); setConfirmed(false)
    try {
      const info = await native.checkLatestVersion(channel)
      setRemote(info)
      setState(cmpVer(info.version, VERSION) > 0 ? 'ready' : 'latest')
    } catch (e) { setErr(String(e)); setState('error') }
  }

  const install = async () => {
    if (!confirmed) return
    setState('installing')
    try {
      const msg = await native.downloadAndRunInstaller(remote.installerUrl)
      push(msg)
      setState('done')
    } catch (e) { setErr(String(e)); setState('error') }
  }

  return (
    <div className="body-pad update">
      <h3>Orbe Update Center</h3>
      <div className="chans">{[['stable', 'Estável'], ['beta', 'Beta']].map(([c, l]) => <button key={c} className={`chan ${channel === c ? 'on' : ''}`} onClick={() => { setChannel(c); setState('idle') }}>{l}<small>{c === 'stable' ? 'Verificado' : 'Antecipado'}</small></button>)}</div>
      <div className="upd-card glass">
        {state === 'idle' && <p>Versão instalada: <b>Orbe Shell {VERSION}</b> · canal {channel}. A verificação consulta os releases publicados do projeto.</p>}
        {state === 'checking' && <p className="muted">Consultando servidor de atualizações…</p>}
        {state === 'latest' && remote && <p>Você está atualizado. Última versão publicada no canal {channel}: <b>{remote.version}</b>.</p>}
        {state === 'ready' && remote && <>
          <p><b>Orbe Shell {remote.version}</b> disponível (canal {remote.channel}).</p>
          <p className="muted">O instalador será baixado da URL oficial e salvo na pasta Downloads. A instalação só começa com sua confirmação explícita abaixo.</p>
          <label className="confirm-row"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> Confirmo que desejo baixar e instalar {remote.version}</label>
          <button className="pill" onClick={install} disabled={!confirmed}>Baixar e instalar {remote.version}</button>
        </>}
        {state === 'installing' && <><div className="prog"><motion.div initial={{ width: 0 }} animate={{ width: '92%' }} transition={{ duration: 8 }} /></div><p className="muted">Baixando instalador e iniciando a instalação…</p></>}
        {state === 'done' && <p>Instalador iniciado. Conclua a instalação na janela do instalador e reabra o Orbe Shell.</p>}
        {(state === 'error' || err) && state !== 'idle' && <div className="panel-err">{err}</div>}
      </div>
      <div className="upd-actions">
        {(state === 'idle' || state === 'error') && <button className="pill" onClick={check} disabled={!native.IS_TAURI}>Verificar atualizações</button>}
        {!native.IS_TAURI && <p className="muted">Disponível apenas no aplicativo nativo.</p>}
      </div>
    </div>
  )
}

// ── Continuity REAL: verifica a saúde dos módulos consultando o backend ──
function ContinuityPanel() {
  const log = useShellStore((s) => s.continuityLog)
  const push = useShellStore((s) => s.pushContinuity)
  const recover = useShellStore((s) => s.emergencyRecovery)
  const [health, setHealth] = useState(null)
  const [checking, setChecking] = useState(false)

  const verify = async () => {
    setChecking(true)
    const results = []
    const probe = async (label, fn) => {
      try { await fn(); results.push([label, true, '']) }
      catch (e) { results.push([label, false, String(e)]) }
    }
    await probe('Sistema', native.sysInfo)
    await probe('Processos', native.listProcesses)
    await probe('Arquivos', () => native.readDir(''))
    await probe('Volume', native.audioState)
    await probe('Papel de parede', native.currentWallpaper)
    const failed = results.filter(([, ok]) => !ok)
    setHealth(results)
    push(failed.length === 0
      ? `Verificação de saúde concluída — ${results.length} módulos operacionais.`
      : `Verificação: ${failed.length} módulo(s) indisponível(is): ${failed.map(([n]) => n).join(', ')}.`)
    setChecking(false)
  }

  return (
    <div className="body-pad">
      <h3>Orbe Continuity</h3>
      <p className="muted">Monitora componentes do shell. Se um widget ou painel falhar, o Orbe registra o evento e restaura o estado da interface — recorrendo ao desktop nativo do Windows apenas quando necessário.</p>
      <div className="cont-grid">
        <button className="pill" onClick={verify} disabled={checking}>{checking ? 'Verificando…' : 'Executar verificação de saúde'}</button>
        <button className="pill danger" onClick={recover}>Recuperação de emergência</button>
      </div>
      {health && (
        <div className="cont-health">
          {health.map(([name, ok, msg]) => (
            <div key={name} className={`ch-row ${ok ? 'ok' : 'bad'}`}>
              <Icon name={ok ? 'shield' : 'close'} size={13} /><span>{name}</span><small>{ok ? 'Operacional' : msg}</small>
            </div>
          ))}
        </div>
      )}
      <div className="cont-log">
        {log.length === 0 && <div className="muted">Nenhum evento registrado.</div>}
        {log.slice().reverse().map((e, i) => <div key={i} className="cont-ev"><span className="cont-time">{new Date(e.t).toLocaleTimeString('pt-BR')}</span>{e.msg}</div>)}
      </div>
    </div>
  )
}

function AboutPanel() {
  const [info, setInfo] = useState(null)
  useEffect(() => { let a = true; native.sysInfo().then((i) => a && setInfo(i)).catch(() => {}); return () => { a = false } }, [])
  return (
    <div className="body-pad about">
      <div className="about-orbe"><span className="orbe-core big" /></div>
      <h2>Orbe Shell</h2>
      <p className="muted">Versão {VERSION} · aplicativo nativo Tauri · experiência de desktop premium para Windows</p>
      <p>Beleza, fluidez, desempenho, inteligência e liberdade de personalização funcionando juntos.</p>
      {info && (
        <div className="about-sys glass">
          <div><span>Sistema</span><b>{info.os} {info.version}</b></div>
          <div><span>Computador</span><b>{info.hostname}</b></div>
          <div><span>Processadores</span><b>{info.cpus} threads</b></div>
          <div><span>Memória</span><b>{info.ramTotalGb > 0 ? `${info.ramTotalGb.toFixed(1)} GB` : 'indisponível nesta plataforma'}</b></div>
          <div><span>Modo</span><b>{native.IS_TAURI ? 'Nativo (Tauri)' : 'Web (desenvolvimento)'}</b></div>
        </div>
      )}
    </div>
  )
}

function Switch({ on, onChange }) {
  return <button className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)}><span /></button>
}

// ── Janela genérica com arrasto, redimensionamento, snap e Genie ───
export function Window({ win }) {
  const nativeApps = useShellStore((s) => s.nativeApps)
  const app = findAppById(win.appId, nativeApps) || internalApp('about')
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
    const up = () => {
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
  }, [win.minimized, win.genie, controls])

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
          <div className="win-body"><AppBody appId={win.appId} /></div>
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
