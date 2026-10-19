// Logo TaskFlow: tre barre sfalsate, come i passi di un flusso di lavoro che avanza da sinistra a destra
// (da fare → in corso → completato). Funziona in colore (tassello giallo) e in monocromia (solo barre).
export function LogoMark({ size = 32, tone = 'color', className = '' }) {
  return (
    <svg className={`logo-mark ${className}`} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      {tone === 'color' && <rect width="32" height="32" rx="9" fill="#FFD600" />}
      <g fill={tone === 'color' ? '#101010' : 'currentColor'}>
        <rect x="6" y="7" width="9" height="4" rx="2" />
        <rect x="11" y="14" width="11" height="4" rx="2" />
        <rect x="17" y="21" width="9" height="4" rx="2" />
      </g>
    </svg>
  );
}

export default function Logo({ size = 32, tone = 'color', showText = true, className = '' }) {
  return (
    <span className={`logo ${className}`}>
      <LogoMark size={size} tone={tone} />
      {showText && (
        <span className="logo-text" style={{ fontSize: size * 0.62 }}>
          Task<span className="logo-flow">Flow</span>
        </span>
      )}
    </span>
  );
}
