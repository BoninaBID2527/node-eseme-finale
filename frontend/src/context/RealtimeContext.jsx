import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api, SESSION_EVENT } from '../api';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const RealtimeContext = createContext(null);

// Una sola connessione Socket.IO per utente. Espone:
//   socket / connected  stato della connessione
//   resyncKey           aumenta ad ogni riconnessione: le pagine lo usano per ricaricare i dati persi nel frattempo
//   unread              numero di notifiche non lette (il server è la fonte di verità)
export function RealtimeProvider({ children }) {
  const { token, user } = useAuth();
  const toast = useToast();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [resyncKey, setResyncKey] = useState(0);
  const [unread, setUnread] = useState(0);
  const wasConnected = useRef(false);

  const refreshUnread = useCallback(() => {
    api.get('/notifications/unread-count').then((d) => setUnread(d.unread)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!token || !user) {
      setUnread(0);
      return undefined;
    }

    refreshUnread();
    const instance = io({ auth: { token }, reconnectionDelayMax: 5000 });
    wasConnected.current = false;

    instance.on('connect', () => {
      setConnected(true);
      // Dopo una riconnessione gli eventi persi vanno recuperati via REST.
      if (wasConnected.current) {
        setResyncKey((k) => k + 1);
        refreshUnread();
      }
      wasConnected.current = true;
    });
    instance.on('disconnect', () => setConnected(false));

    instance.on('notification:new', (notification) => {
      setUnread((n) => n + 1);
      toast(notification.text, 'info');
    });

    // Il server chiude la sessione (blocco, logout da un altro punto, scadenza): torniamo al login.
    instance.on('session:ended', ({ reason }) => {
      if (reason !== 'password' && reason !== 'logout') window.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail: { reason } }));
    });
    instance.on('connect_error', (err) => {
      if (err.data?.code === 'session_invalid') window.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail: { reason: 'ended' } }));
      if (err.data?.code === 'account_blocked') window.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail: { reason: 'blocked' } }));
    });

    setSocket(instance);
    return () => {
      instance.close();
      setSocket(null);
      setConnected(false);
    };
  }, [token, user?._id, refreshUnread, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  const adjustUnread = useCallback((delta) => setUnread((n) => Math.max(n + delta, 0)), []);

  return (
    <RealtimeContext.Provider value={{ socket, connected, resyncKey, unread, adjustUnread, refreshUnread }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export const useRealtime = () => useContext(RealtimeContext);

// Si iscrive a un evento del socket finché il componente è montato.
export function useSocketEvent(event, handler) {
  const { socket } = useRealtime();
  useEffect(() => {
    if (!socket) return undefined;
    socket.on(event, handler);
    return () => socket.off(event, handler);
  }, [socket, event, handler]);
}
