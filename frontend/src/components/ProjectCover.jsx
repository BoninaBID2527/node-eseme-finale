import { useMemo } from 'react';

// Funzione hash + generatore pseudo-casuale con seme: lo stesso progetto produce sempre la stessa copertina.
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function seeded(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Cinque temi nella palette del marchio (nero, giallo, bianco, grigi). Il giallo pieno è raro per non appesantire le griglie.
const THEMES = [
  { bg: '#101010', bar: '#2d2d2d', accent: '#FFD600', arrow: '#101010', grid: '#ffffff' },
  { bg: '#E7E7E3', bar: '#101010', accent: '#FFD600', arrow: '#101010', grid: '#101010' },
  { bg: '#1c1c1c', bar: '#f4f4f0', accent: '#FFD600', arrow: '#101010', grid: '#ffffff' },
  { bg: '#FFFFFF', bar: '#101010', accent: '#FFD600', arrow: '#101010', grid: '#101010' },
  { bg: '#FFD600', bar: '#101010', accent: '#FFFFFF', arrow: '#101010', grid: '#101010' },
];

// Copertina di riserva: barre arrotondate impilate a gradini che salgono verso l'angolo in alto a destra, come nel marchio.
// La barra evidenziata termina con una freccia. Il seme (id del progetto) decide tema, numero e lunghezza delle barre.
export function GeneratedCover({ seed, tall = false, wide = false }) {
  // `wide` è la versione per la testata della pagina progetto (fascia molto larga): la composizione occupa la metà destra.
  const W = wide ? 960 : 320;
  const H = tall ? 290 : 160;
  const { theme, bars, accent, gridX } = useMemo(() => {
    const h = hash(String(seed));
    const rand = seeded(h);
    const count = 4 + Math.floor(rand() * 2); // 4 o 5 barre
    const step = 16 + rand() * 10;
    const list = [];
    for (let i = 0; i < count; i += 1) {
      // i = 0 è la barra più in alto: parte più a destra, così il profilo sale verso destra.
      const width = (74 + rand() * 96) * (wide ? 1.5 : 1);
      const x = (wide ? 400 : 26) + (count - 1 - i) * step * (wide ? 2 : 1) + rand() * 14;
      list.push({ x, width: Math.min(width, W - 20 - x - 34), y: 24 + i * ((H - 48) / count) });
    }
    return { theme: THEMES[h % THEMES.length], bars: list, accent: Math.floor(rand() * 2), gridX: 40 + Math.floor(rand() * 40) };
  }, [seed, H, W, wide]);

  const barHeight = tall ? 20 : 15;
  return (
    <svg className="cover-art" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect width={W} height={H} fill={theme.bg} />
      {Array.from({ length: wide ? 12 : 4 }, (_, i) => i).map((i) => (
        <rect key={i} x={gridX + i * 78} y="0" width="1" height={H} fill={theme.grid} opacity="0.07" />
      ))}
      {bars.map((bar, i) => {
        const isAccent = i === accent;
        return (
          <g key={i}>
            <rect x={bar.x} y={bar.y} width={bar.width} height={barHeight} rx={barHeight / 2} fill={isAccent ? theme.accent : theme.bar} />
            {isAccent && (
              <g transform={`translate(${bar.x + bar.width + 20} ${bar.y + barHeight / 2})`}>
                <circle r="14" fill={theme.accent} />
                <path d="M-5 5 L5 -5 M-3 -5 H5 V3" fill="none" stroke={theme.arrow} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// Copertina caricata dal proprietario oppure quella generata.
export default function ProjectCover({ project, className = '', tall = false, wide = false }) {
  return (
    <div className={`cover ${className}`}>
      {project.coverImage ? (
        <img src={project.coverImage} alt="" loading="lazy" />
      ) : (
        <GeneratedCover seed={project._id || project.title} tall={tall} wide={wide} />
      )}
    </div>
  );
}
