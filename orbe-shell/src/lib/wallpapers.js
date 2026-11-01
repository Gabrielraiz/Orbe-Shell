// Paletas de cores dinâmicas extraídas do papel de parede.
// Em produção, isso será calculado por análise real da imagem (k-means / MMCSS thread).

export const WALLPAPERS = [
  {
    id: 'aurora',
    name: 'Aurora Orbe',
    css: 'radial-gradient(120% 90% at 18% 12%, rgba(64,220,190,.55) 0%, rgba(64,220,190,0) 45%), radial-gradient(110% 90% at 82% 22%, rgba(96,120,255,.55) 0%, rgba(96,120,255,0) 50%), radial-gradient(130% 110% at 50% 108%, rgba(190,80,255,.42) 0%, rgba(190,80,255,0) 55%), linear-gradient(160deg, #0b1020 0%, #0d1430 55%, #0a0e1c 100%)',
    accent: '#4fd8c2',
    accent2: '#7c8cff',
    glow: 'rgba(79,216,194,.35)',
  },
  {
    id: 'ember',
    name: 'Brasa Noturna',
    css: 'radial-gradient(120% 90% at 20% 15%, rgba(255,140,80,.5) 0%, rgba(255,140,80,0) 45%), radial-gradient(110% 90% at 85% 30%, rgba(255,70,120,.42) 0%, rgba(255,70,120,0) 50%), radial-gradient(130% 110% at 45% 110%, rgba(160,40,90,.5) 0%, rgba(160,40,90,0) 55%), linear-gradient(160deg, #140b12 0%, #1c0f18 55%, #0d070c 100%)',
    accent: '#ff8f5e',
    accent2: '#ff5e8a',
    glow: 'rgba(255,143,94,.32)',
  },
  {
    id: 'deepsea',
    name: 'Mar Profundo',
    css: 'radial-gradient(120% 90% at 25% 10%, rgba(40,160,255,.5) 0%, rgba(40,160,255,0) 45%), radial-gradient(110% 90% at 80% 25%, rgba(30,220,200,.4) 0%, rgba(30,220,200,0) 50%), radial-gradient(130% 110% at 50% 110%, rgba(20,60,180,.55) 0%, rgba(20,60,180,0) 55%), linear-gradient(160deg, #061224 0%, #0a1a34 55%, #050b18 100%)',
    accent: '#3fb6ff',
    accent2: '#2ee0c8',
    glow: 'rgba(63,182,255,.32)',
  },
  {
    id: 'violet',
    name: 'Nebulosa Violeta',
    css: 'radial-gradient(120% 90% at 18% 18%, rgba(170,90,255,.5) 0%, rgba(170,90,255,0) 45%), radial-gradient(110% 90% at 85% 20%, rgba(90,60,220,.55) 0%, rgba(90,60,220,0) 50%), radial-gradient(130% 110% at 45% 112%, rgba(255,90,190,.35) 0%, rgba(255,90,190,0) 55%), linear-gradient(160deg, #100a20 0%, #170f30 55%, #0b0718 100%)',
    accent: '#b06aff',
    accent2: '#ff5eb8',
    glow: 'rgba(176,106,255,.35)',
  },
  {
    id: 'graphite',
    name: 'Grafite Minimal',
    css: 'radial-gradient(120% 90% at 30% 12%, rgba(180,190,210,.28) 0%, rgba(180,190,210,0) 45%), radial-gradient(110% 90% at 80% 30%, rgba(120,140,170,.25) 0%, rgba(120,140,170,0) 50%), linear-gradient(160deg, #101318 0%, #171b22 55%, #0c0e12 100%)',
    accent: '#9fb4cc',
    accent2: '#6e8299',
    glow: 'rgba(159,180,204,.25)',
  },
]

export function wallpaperById(id) {
  return WALLPAPERS.find((w) => w.id === id) || WALLPAPERS[0]
}
