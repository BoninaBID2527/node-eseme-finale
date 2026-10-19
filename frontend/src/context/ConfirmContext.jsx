import { createContext, useCallback, useContext, useRef, useState } from 'react';
import Modal from '../components/Modal';

const ConfirmContext = createContext(null);

// Sostituisce window.confirm con un dialogo accessibile: `if (await confirm({...})) { ... }`.
export function ConfirmProvider({ children }) {
  const [options, setOptions] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setOptions(opts);
      }),
    []
  );

  const close = (result) => {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <Modal title={options.title} size="sm" onClose={() => close(false)}>
          <p className="confirm-message">{options.message}</p>
          <div className="modal-actions">
            <button className="btn" onClick={() => close(false)}>
              {options.cancelLabel || 'Annulla'}
            </button>
            <button className={`btn ${options.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)} data-autofocus>
              {options.confirmLabel || 'Conferma'}
            </button>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
