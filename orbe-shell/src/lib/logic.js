// Lógica pura do Orbe Shell — sem dependência de DOM, React ou Tauri.
// Os componentes importam daqui; os testes unitários validam exatamente
// este código de produção (nada é uma cópia à parte).

// ── Encaixe inteligente de janelas (snap zones) ────────────────────────
// Dadas coordenadas do ponteiro e o tamanho da viewport, retorna a zona:
// 'top' | 'tl' | 'tr' | 'left' | 'right' | 'bl' | 'br' | null.
export function snapZone(clientX, clientY, vw, vh) {
  const EDGE = 40, TOP = 60
  if (clientY < TOP) {
    if (clientX < vw * 0.25) return 'tl'
    if (clientX > vw * 0.75) return 'tr'
    return 'top'
  }
  // Cantos inferiores (janela encostada embaixo + lateral)
  if (clientY > vh - 80) {
    if (clientX < EDGE) return 'bl'
    if (clientX > vw - EDGE) return 'br'
  }
  if (clientX < EDGE) return 'left'
  if (clientX > vw - EDGE) return 'right'
  return null
}

// Geometria final de cada zona, respeitando margens e a barra do shell.
export function snapRect(zone, vw, vh) {
  const M = 8, BAR = 70
  const H = vh - BAR
  const zones = {
    left:  { x: M, y: M, w: vw / 2 - 2 * M, h: H - 2 * M },
    right: { x: vw / 2 + M, y: M, w: vw / 2 - 2 * M, h: H - 2 * M },
    top:   { x: M, y: M, w: vw - 2 * M, h: H - 2 * M },
    tl:    { x: M, y: M, w: vw / 2 - 2 * M, h: H / 2 - 2 * M },
    tr:    { x: vw / 2 + M, y: M, w: vw / 2 - 2 * M, h: H / 2 - 2 * M },
    bl:    { x: M, y: H / 2 + M, w: vw / 2 - 2 * M, h: H / 2 - 2 * M },
    br:    { x: vw / 2 + M, y: H / 2 + M, w: vw / 2 - 2 * M, h: H / 2 - 2 * M },
  }
  return zones[zone] || null
}

// ── Avaliador aritmético seguro (Calculadora) ─────────────────────────
// Tokenizador + parser recursivo com precedência. Sem eval/Function.
// Suporta + - * / ( ), decimais, × ÷ (normalizados) e sinal unário.
export function evalExpr(src) {
  let i = 0
  const s = src.replace(/\s+/g, '')
  // rejeita colagem maliciosa de tokens: "1 2" viraria "12", "a b" viraria "ab"
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

// Normaliza símbolos tipográficos de multiplicação/divisão antes de avaliar.
export function normalizeCalcInput(str) {
  return String(str).replace(/×/g, '*').replace(/÷/g, '/')
}
