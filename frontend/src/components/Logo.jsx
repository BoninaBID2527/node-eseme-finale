// Logo BONTASK. Usa le immagini approvate (PNG trasparenti in /public/brand): il marchio non viene ridisegnato né deformato.
//   variant="full"   logo completo (icona + scritta);  variant="icon"  solo icona (favicon, navigazione compatta)
//   tone="light"     per superfici chiare (scritta nera);  tone="dark"  per superfici scure (scritta bianca)
//   height           altezza in pixel; la larghezza segue le proporzioni originali
// La scritta fa parte dell'immagine: non si aggiunge mai un altro "BONTASK" accanto. Se il link o il pulsante che lo contiene
// ha già un nome accessibile (aria-label), si passa `decorative` per non far leggere il nome due volte.
// Percorso base dell'app ("/" in locale, la cartella del sito nella demo su GitHub Pages)
const BASE = import.meta.env.BASE_URL;
const SOURCES = {
  full: { light: `${BASE}brand/bontask-logo.png`, dark: `${BASE}brand/bontask-logo-white.png`, ratio: 1022 / 187 },
  icon: { light: `${BASE}brand/bontask-icon.png`, dark: `${BASE}brand/bontask-icon.png`, ratio: 347 / 349 },
};

export default function Logo({ variant = 'full', tone = 'light', height = 32, decorative = false, className = '' }) {
  const source = SOURCES[variant] || SOURCES.full;
  return (
    <img
      className={`logo logo-${variant} ${className}`}
      src={source[tone] || source.light}
      width={Math.round(height * source.ratio)}
      height={height}
      alt={decorative ? '' : 'BONTASK'}
      decoding="async"
      draggable="false"
    />
  );
}
