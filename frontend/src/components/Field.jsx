import { Children, cloneElement, isValidElement, useId } from 'react';

// Etichetta + campo + messaggio d'errore collegati tra loro per gli screen reader.
// Il messaggio compare accanto al campo ed è associato tramite aria-describedby.
export default function Field({ label, error, hint, optional, children, className = '' }) {
  const id = useId();
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;

  const control = Children.map(children, (child) =>
    isValidElement(child)
      ? cloneElement(child, { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })
      : child
  );

  return (
    <div className={`field${error ? ' has-error' : ''} ${className}`}>
      <label htmlFor={id}>
        {label}
        {optional && <span className="field-optional"> (facoltativo)</span>}
      </label>
      {control}
      {hint && !error && (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
