import Icon from './Icon';

// Stato vuoto con un'azione utile.
export function EmptyState({ icon = 'inbox', title, text, action }) {
  return (
    <div className="state card">
      <span className="state-icon">
        <Icon name={icon} size={24} />
      </span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

// Errore di caricamento con possibilità di riprovare.
export function ErrorState({ message, onRetry }) {
  return (
    <div className="state card state-error" role="alert">
      <span className="state-icon">
        <Icon name="alert" size={24} />
      </span>
      <h3>Qualcosa è andato storto</h3>
      <p>{message}</p>
      {onRetry && (
        <button className="btn" onClick={() => onRetry()}>
          <Icon name="refresh" size={16} /> Riprova
        </button>
      )}
    </div>
  );
}
