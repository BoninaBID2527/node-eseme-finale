import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useRealtime, useSocketEvent } from '../context/RealtimeContext';
import { useToast } from '../context/ToastContext';
import { dayLabel, errorMessage, formatTime, sameDay } from '../utils';
import Avatar from './Avatar';
import Icon from './Icon';

const PAGE = 30;

// Unisce messaggi senza duplicati: l'_id di MongoDB cresce nel tempo, quindi ordinare per _id = ordinare per invio.
const merge = (a, b) => {
  const byId = new Map([...a, ...b].map((m) => [m._id, m]));
  return [...byId.values()].sort((x, y) => (x._id < y._id ? -1 : 1));
};

export default function Chat({ project, readOnly }) {
  const { user } = useAuth();
  const toast = useToast();
  const { connected, resyncKey } = useRealtime();
  const [messages, setMessages] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const stickToBottom = useRef(true);
  const scrollRestore = useRef(null);

  // Primo caricamento e risincronizzazione dopo una riconnessione (i messaggi arrivati nel frattempo vengono recuperati).
  useEffect(() => {
    api
      .get(`/projects/${project._id}/messages?limit=${PAGE}`)
      .then((data) => {
        setMessages((prev) => (prev ? merge(prev, data.messages) : data.messages));
        setHasMore((prev) => (messages ? prev : data.hasMore));
        setError('');
      })
      .catch((err) => setError(errorMessage(err)));
  }, [project._id, resyncKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const addMessage = useCallback(
    (message) => {
      if (message.project !== project._id) return;
      setMessages((list) => (list ? merge(list, [message]) : list));
    },
    [project._id]
  );
  useSocketEvent('chat:message', addMessage);

  const loadOlder = async () => {
    if (!messages?.length) return;
    setLoadingOlder(true);
    try {
      const list = listRef.current;
      scrollRestore.current = { height: list.scrollHeight, top: list.scrollTop };
      const data = await api.get(`/projects/${project._id}/messages?limit=${PAGE}&before=${messages[0]._id}`);
      setMessages((prev) => merge(data.messages, prev));
      setHasMore(data.hasMore);
    } catch (err) {
      scrollRestore.current = null;
      toast(errorMessage(err), 'error');
    } finally {
      setLoadingOlder(false);
    }
  };

  // Dopo ogni aggiornamento: mantiene la posizione leggendo la cronologia, oppure scende in fondo se eri già in fondo.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (scrollRestore.current) {
      list.scrollTop = scrollRestore.current.top + (list.scrollHeight - scrollRestore.current.height);
      scrollRestore.current = null;
    } else if (stickToBottom.current) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages]);

  const onScroll = () => {
    const list = listRef.current;
    stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  };

  const send = async (e) => {
    e?.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      const data = await api.post(`/projects/${project._id}/messages`, { text: value });
      setText('');
      stickToBottom.current = true;
      addMessage(data.message);
    } catch (err) {
      toast(`Messaggio non inviato: ${errorMessage(err)}`, 'error'); // il testo resta nel campo
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) send(e);
  };

  return (
    <div className="chat card">
      {!connected && (
        <p className="chat-offline" role="status">
          <Icon name="wifi-off" size={16} /> Connessione live interrotta: i nuovi messaggi arriveranno appena torna la rete.
        </p>
      )}
      <div className="chat-list" ref={listRef} onScroll={onScroll} data-testid="chat-list" tabIndex={0} aria-label="Cronologia della chat">
        {error && !messages && <p className="form-alert">{error}</p>}
        {!messages && !error && <p className="muted center">Caricamento…</p>}
        {hasMore && (
          <div className="center">
            <button className="btn btn-sm" onClick={loadOlder} disabled={loadingOlder}>
              {loadingOlder ? 'Caricamento…' : 'Carica messaggi precedenti'}
            </button>
          </div>
        )}
        {messages?.length === 0 && (
          <div className="chat-empty">
            <Icon name="message" size={28} />
            <p>Nessun messaggio ancora.</p>
            <small className="muted">Scrivi il primo per salutare il team.</small>
          </div>
        )}
        {messages?.map((m, i) => {
          const mine = m.author._id === user._id;
          const newDay = i === 0 || !sameDay(messages[i - 1].createdAt, m.createdAt);
          const grouped = !newDay && messages[i - 1].author._id === m.author._id;
          return (
            <div key={m._id}>
              {newDay && <div className="chat-day"><span>{dayLabel(m.createdAt)}</span></div>}
              <div className={`msg${mine ? ' mine' : ''}${grouped ? ' grouped' : ''}`}>
                {!mine && (grouped ? <span style={{ width: 28 }} /> : <Avatar name={m.author.name} size={28} />)}
                <div className="bubble">
                  {!mine && !grouped && <strong>{m.author.name}</strong>}
                  <p>{m.text}</p>
                  <small>{formatTime(m.createdAt)}</small>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {readOnly ? (
        <p className="chat-readonly">La chat è in sola lettura perché il progetto non è modificabile.</p>
      ) : (
        <form className="chat-form" onSubmit={send}>
          <label htmlFor="chat-input" className="visually-hidden">Scrivi un messaggio</label>
          <textarea id="chat-input" rows={1} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown} placeholder="Scrivi un messaggio… (Invio per inviare)" maxLength={2000} />
          <button className="btn btn-primary" disabled={!text.trim() || sending} aria-label="Invia messaggio">
            <Icon name="send" size={18} />
          </button>
        </form>
      )}
    </div>
  );
}
