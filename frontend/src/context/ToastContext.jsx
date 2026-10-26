import { createContext, useCallback, useContext, useState } from 'react';
import Icon from '../components/Icon';
import { DEMO, DEMO_MESSAGE } from '../demo/constants';

const ToastContext = createContext(null);

const ICONS = { success: 'check-circle', error: 'alert', info: 'info' };

// Notifiche temporanee. Gli errori usano role="alert" (letti subito dagli screen reader), il resto "status".
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    (message, type = 'info') => {
      if (DEMO && String(message).includes(DEMO_MESSAGE)) return; // nella demo lo spiega già il popup
      const id = Date.now() + Math.random();
      setToasts((list) => [...list.slice(-3), { id, message, type }]);
      setTimeout(() => dismiss(id), type === 'error' ? 7000 : 4500);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} role={t.type === 'error' ? 'alert' : 'status'}>
            <Icon name={ICONS[t.type]} size={18} />
            <span>{t.message}</span>
            <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Chiudi notifica">
              <Icon name="x" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
