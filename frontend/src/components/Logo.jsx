// Logo BONHUB. Usa le immagini approvate (PNG trasparenti in /public/brand): il marchio non viene ridisegnato né deformato.
//   variant="full"   logo completo (icona + scritta);  variant="icon"  solo icona (favicon, navigazione compatta)
//   tone="light"     per superfici chiare (scritta nera);  tone="dark"  per superfici scure (scritta bianca)
//   height           altezza in pixel; la larghezza segue le proporzioni originali
// La scritta fa parte dell'immagine: non si aggiunge mai un altro "BONHUB" accanto. Se il link o il pulsante che lo contiene
// ha già un nome accessibile (aria-label), si passa `decorative` per non far leggere il nome due volte.
const SOURCES = {
  full: { light: '/brand/bonhub-logo.png', dark: '/brand/bonhub-logo-white.png', ratio: 1678 / 349 },
  icon: { light: '/brand/bonhub-icon.png', dark: '/brand/bonhub-icon.png', ratio: 347 / 349 },
};

export default function Logo({ variant = 'full', tone = 'light', height = 32, decorative = false, className = '' }) {
  const source = SOURCES[variant] || SOURCES.full;
  return (
    <img
      className={`logo logo-${variant} ${className}`}
      src={source[tone] || source.light}
      width={Math.round(height * source.ratio)}
      height={height}
      alt={decorative ? '' : 'BONHUB'}
      decoding="async"
      draggable="false"
    />
  );
}
