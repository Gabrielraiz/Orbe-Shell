// Glifos dos aplicativos (desenhados em SVG, estilo "tile" premium)
export function Glyph({ name, size = 26 }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'rgba(255,255,255,.92)', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (name) {
    case 'folder':
      return <svg {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></svg>
    case 'globe':
      return <svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5c2.6 2.4 2.6 14.6 0 17M12 3.5c-2.6 2.4-2.6 14.6 0 17M3.6 9.5h16.8M3.6 14.5h16.8" /></svg>
    case 'bag':
      return <svg {...p}><path d="M5 8h14l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H7.7a1.5 1.5 0 0 1-1.5-1.3L5 8Z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></svg>
    case 'gear':
      return <svg {...p}><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3 5.5 5.5" /></svg>
    case 'orb':
      return <svg {...p}><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.6" fill="rgba(255,255,255,.85)" stroke="none" /><path d="M12 5a7 7 0 0 1 6.4 4.2" stroke="rgba(255,255,255,.5)" /></svg>
    case 'term':
      return <svg {...p}><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><path d="m7 10 3 2.5L7 15M12.5 15H17" /></svg>
    case 'image':
      return <svg {...p}><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="m5 17 4.5-4.5L13 16l3-3 4 4" /></svg>
    case 'music':
      return <svg {...p}><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></svg>
    case 'mail':
      return <svg {...p}><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="m4.5 7.5 7.5 6 7.5-6" /></svg>
    case 'calendar':
      return <svg {...p}><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>
    case 'calc':
      return <svg {...p}><rect x="5" y="3" width="14" height="18" rx="2.5" /><path d="M8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 15.5h.01M12 15.5h.01M15.5 15.5h.01" /></svg>
    case 'note':
      return <svg {...p}><path d="M6 3.5h12a1.5 1.5 0 0 1 1.5 1.5v11L15 20.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5Z" /><path d="M19.5 16H15v4.5M8 8h8M8 12h8" /></svg>
    case 'code':
      return <svg {...p}><path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 6.5l-3 11" /></svg>
    case 'game':
      return <svg {...p}><path d="M7 8h10a4.5 4.5 0 0 1 4.4 5.4l-.7 3.3A2.6 2.6 0 0 1 16.4 18l-1.2-2h-6.4l-1.2 2a2.6 2.6 0 0 1-4.3-1.3l-.7-3.3A4.5 4.5 0 0 1 7 8Z" /><path d="M8.5 11v2.4M7.3 12.2h2.4M15.5 11.6h.01M17.2 13.2h.01" /></svg>
    case 'shield':
      return <svg {...p}><path d="M12 3 5 5.8v5.4c0 4.4 3 7.6 7 9.8 4-2.2 7-5.4 7-9.8V5.8L12 3Z" /><path d="m9 11.8 2.2 2.2L15.4 9.6" /></svg>
    case 'refresh':
      return <svg {...p}><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v4.5h-4.5" /></svg>
    case 'pulse':
      return <svg {...p}><path d="M3 12h4l2.5-6 4 12 2.5-6h5" /></svg>
    default:
      return <svg {...p}><circle cx="12" cy="12" r="7.5" /></svg>
  }
}

// Ícones de UI genéricos
export function Icon({ name, size = 16, color = 'currentColor', strokeWidth = 1.8, style }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', style }
  switch (name) {
    case 'search': return <svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 5 5" /></svg>
    case 'close': return <svg {...p}><path d="M6 6 18 18M18 6 6 18" /></svg>
    case 'min': return <svg {...p}><path d="M6 12h12" /></svg>
    case 'max': return <svg {...p}><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
    case 'restore': return <svg {...p}><rect x="4.5" y="8" width="11" height="11" rx="2" /><path d="M8.5 8V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-2" /></svg>
    case 'power': return <svg {...p}><path d="M12 3v8" /><path d="M18.4 6.6a9 9 0 1 1-12.8 0" /></svg>
    case 'lock': return <svg {...p}><rect x="5.5" y="10.5" width="13" height="9" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></svg>
    case 'wifi': return <svg {...p}><path d="M2.5 9a15 15 0 0 1 19 0M5.5 12.5a10 10 0 0 1 13 0M8.5 16a5.5 5.5 0 0 1 7 0" /><circle cx="12" cy="19.3" r="0.8" fill={color} /></svg>
    case 'volume': return <svg {...p}><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4Z" /><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" /></svg>
    case 'battery': return <svg {...p}><rect x="3" y="8" width="16" height="8" rx="2" /><path d="M21.5 11v2" /><rect x="5.5" y="10.2" width="9" height="3.6" rx="1" fill={color} stroke="none" /></svg>
    case 'chevron': return <svg {...p}><path d="m9 6 6 6-6 6" /></svg>
    case 'plus': return <svg {...p}><path d="M12 5v14M5 12h14" /></svg>
    case 'pin': return <svg {...p}><path d="M12 21v-6M8 3h8l-1 6 3 3H6l3-3-1-6Z" /></svg>
    case 'trash': return <svg {...p}><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" /></svg>
    case 'copy': return <svg {...p}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M4.5 16V6a2 2 0 0 1 2-2H16" /></svg>
    case 'info': return <svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.8h.01" /></svg>
    case 'sparkle': return <svg {...p}><path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.5 10.2 12.6 4.5 10.8 10.2 9 12 3.5Z" /><path d="M19 16.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" /></svg>
    case 'layers': return <svg {...p}><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></svg>
    case 'sliders': return <svg {...p}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
    case 'palette': return <svg {...p}><path d="M12 3a9 9 0 0 0 0 18c1.5 0 2.2-1 2.2-2 0-1.3-1.2-1.6-1.2-2.7 0-.8.6-1.3 1.5-1.3H16a5 5 0 0 0 5-5c0-3.9-4-7-9-7Z" /><circle cx="7.5" cy="11" r="1" fill={color} stroke="none" /><circle cx="10.5" cy="7.5" r="1" fill={color} stroke="none" /><circle cx="15" cy="8" r="1" fill={color} stroke="none" /></svg>
    case 'monitoring': return <svg {...p}><path d="M3 13h4l2-5 3 9 2-4h7" /></svg>
    case 'sun': return <svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4 5.6 5.6" /></svg>
    case 'moon': return <svg {...p}><path d="M20 13.5A8.5 8.5 0 1 1 10.5 4 6.8 6.8 0 0 0 20 13.5Z" /></svg>
    case 'play': return <svg {...p}><path d="M8 5.5v13l11-6.5L8 5.5Z" /></svg>
    case 'next': return <svg {...p}><path d="M6 5.5v13l9-6.5-9-6.5Z" /><path d="M18 5.5v13" /></svg>
    case 'prev': return <svg {...p}><path d="M18 5.5v13L9 12l9-6.5Z" /><path d="M6 5.5v13" /></svg>
    case 'exit': return <svg {...p}><path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 8l-4 4 4 4M6 12h10" /></svg>
    default: return <svg {...p}><circle cx="12" cy="12" r="8" /></svg>
  }
}
