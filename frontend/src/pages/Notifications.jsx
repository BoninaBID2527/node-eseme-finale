import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Icon from '../components/Icon';
import InvitationList from '../components/InvitationList';
import { RowsSkeleton } from '../components/Skeleton';
import { EmptyState, ErrorState } from '../components/StateMessage';
import { useRealtime, useSocketEvent } from '../context/RealtimeContext';
import { useToast } from '../context/ToastContext';
import useAsync from '../hooks/useAsync';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { errorMessage, notificationLink, timeAgo } from '../utils';

const ICONS = {
  task_assigned: 'tasks',
  task_moved: 'board',
  member_joined: 'users',
  member_left: 'users',
  member_removed: 'logout',
  project_invitation: 'user-plus',
  invitation_declined: 'x',
  project_reported: 'flag',
  project_hidden: 'eye-off',
};

export default function Notifications() {
  useDocumentTitle('Notifiche');
  const navigate = useNavigate();
  const toast = useToast();
  const { unread, adjustUnread, refreshUnread, resyncKey } = useRealtime();
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [extra, setExtra] = useState({ page: 1, items: [], hasMore: false, loadingMore: false });

  const first = useAsync(() => api.get(`/notifications?limit=20${onlyUnread ? '&unread=true' : ''}`), [onlyUnread, resyncKey]);
  const invitations = useAsync(() => api.get('/invitations'), [resyncKey]);

  // Una nuova notifica live aggiorna elenco e inviti senza ricaricare la pagina.
  const reloadFirst = first.reload;
  const reloadInvitations = invitations.reload;
  useSocketEvent(
    'notification:new',
    useCallback(() => {
      reloadFirst({ silent: true });
      reloadInvitations({ silent: true });
      setExtra({ page: 1, items: [], hasMore: false, loadingMore: false });
    }, [reloadFirst, reloadInvitations])
  );

  const list = first.data ? [...first.data.notifications, ...extra.items] : [];
  const hasMore = first.data ? (extra.page === 1 ? first.data.pages > 1 : extra.hasMore) : false;

  const loadMore = async () => {
    setExtra((e) => ({ ...e, loadingMore: true }));
    try {
      const next = extra.page + 1;
      const data = await api.get(`/notifications?limit=20&page=${next}${onlyUnread ? '&unread=true' : ''}`);
      setExtra((e) => ({ page: next, items: [...e.items, ...data.notifications], hasMore: data.page < data.pages, loadingMore: false }));
    } catch (err) {
      toast(errorMessage(err), 'error');
      setExtra((e) => ({ ...e, loadingMore: false }));
    }
  };

  const markLocal = (id) => {
    first.setData((d) => d && { ...d, notifications: d.notifications.map((n) => (n._id === id ? { ...n, read: true } : n)) });
    setExtra((e) => ({ ...e, items: e.items.map((n) => (n._id === id ? { ...n, read: true } : n)) }));
  };

  const open = async (n) => {
    if (!n.read) {
      markLocal(n._id);
      adjustUnread(-1);
      api.patch(`/notifications/${n._id}/read`).catch(() => refreshUnread());
    }
    const link = notificationLink(n);
    if (link) navigate(link);
  };

  const markAll = async () => {
    try {
      await api.patch('/notifications/read-all');
      first.reload({ silent: true });
      setExtra({ page: 1, items: [], hasMore: false, loadingMore: false });
      refreshUnread();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <div className="page page-narrow">
      <header className="page-head">
        <div>
          <h1 className="page-title">Notifiche</h1>
          <p className="page-lead">Task assegnati, cambi di stato, nuovi membri e inviti ai progetti.</p>
        </div>
        <button className="btn" onClick={markAll} disabled={unread === 0}>
          <Icon name="check" size={16} /> Segna tutte come lette
        </button>
      </header>

      {invitations.data?.invitations.length > 0 && (
        <section className="section-first" aria-labelledby="inv-title">
          <h2 id="inv-title" className="sr-title">Inviti in sospeso</h2>
          <div className="card">
            <InvitationList invitations={invitations.data.invitations} onChanged={() => invitations.reload({ silent: true })} />
          </div>
        </section>
      )}

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Filtra le notifiche">
          <button aria-pressed={!onlyUnread} onClick={() => setOnlyUnread(false)}>Tutte</button>
          <button aria-pressed={onlyUnread} onClick={() => setOnlyUnread(true)}>Non lette{unread > 0 ? ` (${unread})` : ''}</button>
        </div>
      </div>

      {first.error && <ErrorState message={first.error} onRetry={first.reload} />}
      {!first.error && !first.data && <RowsSkeleton rows={5} />}
      {!first.error && first.data && list.length === 0 && (
        <EmptyState
          icon="bell"
          title={onlyUnread ? 'Sei in pari con tutto' : 'Nessuna notifica'}
          text={onlyUnread ? 'Non hai notifiche da leggere.' : 'Qui compariranno gli avvisi sui tuoi progetti e task.'}
          action={onlyUnread ? <button className="btn" onClick={() => setOnlyUnread(false)}>Mostra tutte</button> : undefined}
        />
      )}
      {!first.error && list.length > 0 && (
        <>
          <ul className="card list notif-list" data-testid="notifications">
            {list.map((n) => (
              <li key={n._id}>
                <button className={`notif${n.read ? '' : ' is-unread'}`} onClick={() => open(n)}>
                  <span className="notif-icon">
                    <Icon name={ICONS[n.type] || 'bell'} size={18} />
                  </span>
                  <span className="grow notif-text">
                    <span>{n.text}</span>
                    <small className="muted">
                      {timeAgo(n.createdAt)}
                      {!n.read && <span className="visually-hidden"> · non letta</span>}
                    </small>
                  </span>
                  {!n.read && <span className="unread-dot" aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
          {hasMore && (
            <div className="load-more">
              <button className="btn" onClick={loadMore} disabled={extra.loadingMore}>
                {extra.loadingMore ? 'Caricamento…' : 'Carica altre notifiche'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
