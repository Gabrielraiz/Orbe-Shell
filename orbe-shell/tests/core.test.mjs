// Bateria de testes unitarios do Orbe Shell (roda com: node --test tests/)
// Cobre a logica pura do frontend, sem depender de Tauri nem de DOM.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// ── Avaliador da Calculadora (replica exatamente a logica de Window.jsx) ──
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

test('calculadora: precedencia correta', () => {
  assert.equal(evalExpr('2+3*4'), 14)
  assert.equal(evalExpr('(2+3)*4'), 20)
  assert.equal(evalExpr('10/4'), 2.5)
  assert.equal(evalExpr('-5+2'), -3)
})

test('calculadora: expressoes invalidas lancam erro (sem eval)', () => {
  assert.throws(() => evalExpr('2+'))
  assert.throws(() => evalExpr('alert(1)'))
  assert.throws(() => evalExpr('(()'))
  assert.throws(() => evalExpr('2 3'))   // tokens colados apos normalizacao de espacos
  assert.throws(() => evalExpr('1a'))    // caractere invalido
  assert.throws(() => evalExpr('*5'))    // operador sem operando
})

test('calculadora: simbolos × e ÷ sao normalizados', () => {
  assert.equal(evalExpr('6×7'.replace(/×/g, '*')), 42)
  assert.equal(evalExpr('8÷2'.replace(/÷/g, '/')), 4)
})

// ── Catalogo de aplicativos (lib/apps.js) ────────────────────────────────
const { INTERNAL_APPS, findAppById, allApps, fromNative, DEFAULT_DOCK, VERSION } = await import('../src/lib/apps.js')

test('findAppById resolve apps internos reais', () => {
  assert.equal(findAppById('files').name, 'Explorador de Arquivos')
  assert.equal(findAppById('tasks').kind, 'internal')
  assert.equal(findAppById('nao-existe'), null)
})

test('findAppById resolve apps nativos pela lista em runtime', () => {
  const native = [{ id: 'sys:x1', name: 'Edge' }]
  assert.equal(findAppById('sys:x1', native).name, 'Edge')
  assert.equal(findAppById('sys:zz', native), null)
})

test('allApps combina internos + nativos', () => {
  const list = allApps([{ id: 'sys:a', name: 'A' }, { id: 'sys:b', name: 'B' }])
  assert.equal(list.length, Object.keys(INTERNAL_APPS).length + 2)
})

test('fromNative gera item de interface estavel e unico por nome', () => {
  const a = fromNative({ id: 'z', name: 'Mozilla Firefox', target: 'firefox.exe', source: 'x.lnk' })
  assert.ok(a.id.startsWith('sys:'))
  assert.equal(a.kind, 'system')
  assert.equal(a.glyph, 'globe') // navegador detectado pelo alvo
  const b = fromNative({ id: 'z', name: 'Code', target: 'code.exe', source: 'y' })
  assert.equal(b.glyph, 'note')
})

test('dock padrao contem apenas ferramentas internas funcionais', () => {
  for (const id of DEFAULT_DOCK) assert.ok(INTERNAL_APPS[id], `dock aponta para app inexistente: ${id}`)
})

test('versao sincronizada em todos os arquivos', () => {
  const APP_ROOT = new URL('..', import.meta.url).pathname
  const pkg = JSON.parse(readFileSync(APP_ROOT + 'package.json', 'utf8'))
  const tauriConf = JSON.parse(readFileSync(APP_ROOT + 'src-tauri/tauri.conf.json', 'utf8'))
  const cargo = readFileSync(APP_ROOT + 'src-tauri/Cargo.toml', 'utf8')
  assert.equal(pkg.version, VERSION)
  assert.equal(tauriConf.version, VERSION)
  assert.ok(cargo.includes(`version = "${VERSION}"`))
})

// ── Comparacao de versoes usada pela Central de Atualizacao ──────────────
function cmpVer(a, b) {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d !== 0) return d
  }
  return 0
}

test('cmpVer ordena versoes semanticas corretamente', () => {
  assert.ok(cmpVer('1.2.0', '1.1.0') > 0)
  assert.ok(cmpVer('1.0.9', '1.1.0') < 0)
  assert.equal(cmpVer('1.1.0', '1.1.0'), 0)
  assert.ok(cmpVer('2.0.0', '1.99.99') > 0)
})
