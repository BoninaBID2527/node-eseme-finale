import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from '../api';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const RealtimeContext = createContext(null);

// Tiene una sola connessione Socket.IO per utente e gestisce le notifiche personali.
export function RealtimeProvider({ children }) {
  const { token, user } = useAuth();
  const toast = useToast();
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!token || !user) {
      setNotifications([]);
      return undefined;
    }

    api.get('/notifications').then((data) => setNotifications(data.notifications)).catch(() => {});

    const instance = io({ auth: { token } });
    instance.on('notification:new', (notification) => {
      setNotifications((list) => [notification, ...list.filter((n) => n._id !== notification._id)]);
      toast(notification.text, 'info');
    });
    setSocket(instance);

    return () => {
      instance.close();
      setSocket(null);
    };
  }, [token, user, toast]);

  const markRead = useCallback(async (id) => {
    setNotifications((list) => list.map((n) => (n._id === id ? { ...n, read: true } : n)));
    await api.patch(`/notifications/${id}/read`).catch(() => {});
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((list) => list.map((n) => ({ ...n, read: true })));
    await api.patch('/notifications/read-all').catch(() => {});
  }, []);

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <RealtimeContext.Provider value={{ socket, notifications, unread, markRead, markAllRead }}>
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
