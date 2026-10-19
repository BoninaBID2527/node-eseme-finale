import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRealtime } from '../context/RealtimeContext';
import { formatDate, formatTime } from '../utils';

export default function NotificationBell() {
  const { notifications, unread, markRead, markAllRead } = useRealtime();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  // Chiude il menu cliccando fuori.
  useEffect(() => {
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const openNotification = (n) => {
    if (!n.read) markRead(n._id);
    setOpen(false);
    if (n.project) navigate(n.type === 'project_reported' ? '/admin' : `/projects/${n.project}`);
  };

  return (
    <div className="bell" ref={ref}>
      <button className="icon-btn bell-btn" onClick={() => setOpen(!open)} aria-label="Notifiche">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && <span className="bell-count">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="bell-menu">
          <div className="bell-head">
            <strong>Notifiche</strong>
            {unread > 0 && (
              <button className="link-btn" onClick={markAllRead}>
                Segna tutte come lette
              </button>
            )}
          </div>
          {notifications.length === 0 && <p className="muted bell-empty">Nessuna notifica.</p>}
          <ul>
            {notifications.map((n) => (
              <li key={n._id}>
                <button className={`bell-item${n.read ? '' : ' unread'}`} onClick={() => openNotification(n)}>
                  <span>{n.text}</span>
                  <small>
                    {formatDate(n.createdAt)} · {formatTime(n.createdAt)}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
