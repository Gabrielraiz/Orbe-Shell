import { Glyph } from './icons/Icons'

// Ícone de aplicativo: "tile" com gradiente, brilho interno e borda delicada
export function AppIcon({ app, size = 48, radius = null, active = false }) {
  const r = radius ?? Math.round(size * 0.26)
  return (
    <div
      className="app-icon"
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: `linear-gradient(150deg, ${app.color1} 0%, ${app.color2} 100%)`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.35), inset 0 -6px 12px rgba(0,0,0,.18), 0 ${Math.max(2, size / 14)}px ${Math.max(6, size / 3)}px rgba(0,0,0,.35)${active ? ', 0 0 0 2px var(--accent)' : ''}`,
      }}
    >
      <span className="app-icon-sheen" />
      <Glyph name={app.glyph} size={Math.round(size * 0.52)} />
    </div>
  )
}
