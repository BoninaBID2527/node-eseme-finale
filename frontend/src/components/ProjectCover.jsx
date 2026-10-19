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

// Combinazioni nella palette del marchio. Il fondo giallo è volutamente più raro (1 su 5) per non appesantire le griglie.
const INK = { bg: '#101010', bar: '#2C2C2C', accent: '#FFD600' };
const GRAY = { bg: '#E9E9E6', bar: '#101010', accent: '#FFD600' };
const YELLOW = { bg: '#FFD600', bar: '#101010', accent: '#FFFFFF' };
const THEMES = [INK, GRAY, INK, GRAY, YELLOW];

// Copertina di fallback: barre sfalsate in stile diagramma di Gantt, la "timeline" del progetto.
// Il seme (id del progetto) decide tema, numero e lunghezza delle barre.
export function GeneratedCover({ seed }) {
  const { theme, bars } = useMemo(() => {
    const h = hash(String(seed));
    const rand = seeded(h);
    const count = 4 + Math.floor(rand() * 3);
    const accentIndex = Math.floor(rand() * count);
    const list = [];
    let start = 18 + rand() * 40;
    for (let i = 0; i < count; i += 1) {
      const width = 70 + rand() * 120;
      list.push({ x: Math.min(start, 320 - width - 16), width, accent: i === accentIndex });
      start += 10 + rand() * 55;
    }
    return { theme: THEMES[h % THEMES.length], bars: list };
  }, [seed]);

  const rowHeight = 120 / (bars.length + 1);
  return (
    <svg className="cover-art" viewBox="0 0 320 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect width="320" height="120" fill={theme.bg} />
      {bars.map((bar, i) => (
        <rect
          key={i}
          x={bar.x}
          y={rowHeight * (i + 1) - 5}
          width={bar.width}
          height="10"
          rx="5"
          fill={bar.accent ? theme.accent : theme.bar}
        />
      ))}
    </svg>
  );
}

// Copertina caricata dal proprietario oppure quella generata.
export default function ProjectCover({ project, className = '' }) {
  return (
    <div className={`cover ${className}`}>
      {project.coverImage ? (
        <img src={project.coverImage} alt="" loading="lazy" />
      ) : (
        <GeneratedCover seed={project._id || project.title} />
      )}
    </div>
  );
}
