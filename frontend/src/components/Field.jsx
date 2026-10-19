import { Children, cloneElement, isValidElement, useId } from 'react';
import Icon from './Icon';

// Etichetta + campo + messaggio d'errore collegati tra loro per gli screen reader.
// Il messaggio compare accanto al campo ed è associato tramite aria-describedby.
//   counter    testo breve a destra dell'etichetta (es. "12/100")
//   adornment  elemento accanto al campo, dentro lo stesso riquadro (es. il pulsante "mostra password")
export default function Field({ label, error, hint, optional, counter, adornment, children, className = '' }) {
  const id = useId();
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;

  const control = Children.map(children, (child) =>
    isValidElement(child)
      ? cloneElement(child, { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })
      : child
  );

  return (
    <div className={`field${error ? ' has-error' : ''} ${className}`}>
      <div className="field-label-row">
        <label htmlFor={id}>
          {label}
          {optional && <span className="field-optional"> (facoltativo)</span>}
        </label>
        {counter && <span className="field-counter" aria-hidden="true">{counter}</span>}
      </div>
      {adornment ? (
        <div className="input-wrap">
          {control}
          {adornment}
        </div>
      ) : (
        control
      )}
      {hint && !error && (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-error" id={`${id}-error`}>
          <Icon name="alert" size={15} />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
