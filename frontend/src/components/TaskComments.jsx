import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useRealtime, useSocketEvent } from '../context/RealtimeContext';
import { useToast } from '../context/ToastContext';
import { errorMessage, timeAgo } from '../utils';
import Avatar from './Avatar';
import Icon from './Icon';

// Commenti di un task: si leggono e si scrivono nel dettaglio del task, anche in tempo reale.
// Può eliminare un commento chi l'ha scritto o il proprietario del progetto.
export default function TaskComments({ projectId, taskId, readOnly, canModerate }) {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { resyncKey } = useRealtime();
  const [comments, setComments] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const url = `/projects/${projectId}/tasks/${taskId}/comments`;

  // Unisce senza duplicati (la risposta HTTP e l'evento live portano lo stesso commento).
  const merge = (list, extra) => {
    const byId = new Map([...list, ...extra].map((c) => [c._id, c]));
    return [...byId.values()].sort((a, b) => (a._id < b._id ? -1 : 1));
  };

  useEffect(() => {
    api
      .get(`${url}?limit=30`)
      .then((data) => {
        setComments((prev) => (prev ? merge(prev, data.comments) : data.comments));
        setHasMore((prev) => (comments ? prev : data.hasMore));
      })
      .catch((err) => toast(errorMessage(err), 'error'));
  }, [url, resyncKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useSocketEvent('comment:created', useCallback((c) => c.task === taskId && setComments((l) => (l ? merge(l, [c]) : l)), [taskId]));
  useSocketEvent('comment:deleted', useCallback((c) => c.task === taskId && setComments((l) => l && l.filter((x) => x._id !== c._id)), [taskId]));

  const loadOlder = async () => {
    try {
      const data = await api.get(`${url}?limit=30&before=${comments[0]._id}`);
      setComments((l) => merge(data.comments, l));
      setHasMore(data.hasMore);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api.post(url, { text });
      setComments((l) => merge(l || [], [data.comment]));
      setText('');
    } catch (err) {
      setError(err.fields?.text || errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (comment) => {
    const ok = await confirm({ title: 'Eliminare il commento?', message: 'Il commento verrà eliminato per tutti i membri.', confirmLabel: 'Elimina', danger: true });
    if (!ok) return;
    try {
      await api.delete(`${url}/${comment._id}`);
      setComments((l) => l.filter((c) => c._id !== comment._id));
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <section className="comments" aria-labelledby="comments-title">
      <h3 id="comments-title">
        Commenti {comments && <span className="tab-count">{comments.length}{hasMore ? '+' : ''}</span>}
      </h3>

      {hasMore && (
        <button className="btn btn-sm" onClick={loadOlder}>
          Carica commenti precedenti
        </button>
      )}
      {comments?.length === 0 && <p className="muted">Nessun commento. Scrivi il primo per aggiornare il team su questo task.</p>}
      <ul className="comment-list" data-testid="comments">
        {comments?.map((c) => (
          <li key={c._id} className="comment">
            <Avatar name={c.author.name} size={30} />
            <div className="comment-body">
              <div className="comment-head">
                <strong>{c.author.name}</strong>
                <time dateTime={c.createdAt} className="muted">{timeAgo(c.createdAt)}</time>
                {!readOnly && (c.author._id === user._id || canModerate) && (
                  <button className="icon-btn comment-delete" onClick={() => remove(c)} aria-label={`Elimina il commento di ${c.author.name}`}>
                    <Icon name="trash" size={15} />
                  </button>
                )}
              </div>
              <p>{c.text}</p>
            </div>
          </li>
        ))}
      </ul>

      {!readOnly && (
        <form className="comment-form" onSubmit={send}>
          <label htmlFor="comment-input" className="visually-hidden">Scrivi un commento</label>
          <textarea id="comment-input" rows={2} value={text} onChange={(e) => { setText(e.target.value); setError(''); }} maxLength={1000} placeholder="Scrivi un commento…" aria-invalid={error ? true : undefined} />
          {error && <p className="field-error">{error}</p>}
          <div>
            <button className="btn btn-primary btn-sm" disabled={busy || !text.trim()}>
              <Icon name="send" size={14} /> Commenta
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
