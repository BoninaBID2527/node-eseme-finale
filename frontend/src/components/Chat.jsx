import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useSocketEvent } from '../context/RealtimeContext';
import { useToast } from '../context/ToastContext';
import { formatTime } from '../utils';
import Avatar from './Avatar';

export default function Chat({ projectId }) {
  const { user } = useAuth();
  const toast = useToast();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    api
      .get(`/projects/${projectId}/messages`)
      .then((data) => setMessages(data.messages))
      .catch((err) => toast(err.message, 'error'));
  }, [projectId, toast]);

  // Aggiunge un messaggio solo se è di questo progetto e non è già presente.
  const addMessage = useCallback(
    (message) => {
      if (message.project !== projectId) return;
      setMessages((list) => (list.some((m) => m._id === message._id) ? list : [...list, message]));
    },
    [projectId]
  );
  useSocketEvent('chat:message', addMessage);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText('');
    try {
      const data = await api.post(`/projects/${projectId}/messages`, { text: value });
      addMessage(data.message);
    } catch (err) {
      setText(value);
      toast(err.message, 'error');
    }
  };

  return (
    <div className="chat">
      <div className="chat-list" ref={listRef} data-testid="chat-list">
        {messages.length === 0 && <p className="muted center">Nessun messaggio. Scrivi il primo!</p>}
        {messages.map((m) => {
          const mine = m.author._id === user._id;
          return (
            <div key={m._id} className={`msg${mine ? ' mine' : ''}`}>
              {!mine && <Avatar name={m.author.name} size={26} />}
              <div className="bubble">
                {!mine && <strong>{m.author.name}</strong>}
                <p>{m.text}</p>
                <small>{formatTime(m.createdAt)}</small>
              </div>
            </div>
          );
        })}
      </div>
      <form className="chat-form" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Scrivi un messaggio…" maxLength={2000} aria-label="Messaggio" />
        <button className="btn btn-primary" disabled={!text.trim()}>
          Invia
        </button>
      </form>
    </div>
  );
}
