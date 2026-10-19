import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useRealtime, useSocketEvent } from '../context/RealtimeContext';
import { useToast } from '../context/ToastContext';
import { ACTIVITY_ICONS, errorMessage, timeAgo } from '../utils';
import Icon from './Icon';
import { Skeleton } from './Skeleton';

// Cronologia del progetto: chi ha fatto cosa, dalla più recente. Le nuove attività compaiono in tempo reale.
export default function ActivityFeed({ projectId }) {
  const toast = useToast();
  const { resyncKey } = useRealtime();
  const [items, setItems] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const merge = (a, b) => {
    const byId = new Map([...a, ...b].map((x) => [x._id, x]));
    return [...byId.values()].sort((x, y) => (x._id < y._id ? 1 : -1)); // dalla più recente
  };

  useEffect(() => {
    api
      .get(`/projects/${projectId}/activity?limit=10`)
      .then((data) => {
        setItems((prev) => (prev ? merge(prev, data.activities) : data.activities));
        setHasMore((prev) => (items ? prev : data.hasMore));
      })
      .catch((err) => toast(errorMessage(err), 'error'));
  }, [projectId, resyncKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useSocketEvent('activity:new', useCallback((a) => a.project === projectId && setItems((l) => (l ? merge(l, [a]) : l)), [projectId]));

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const data = await api.get(`/projects/${projectId}/activity?limit=15&before=${items[items.length - 1]._id}`);
      setItems((l) => merge(l, data.activities));
      setHasMore(data.hasMore);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setLoadingMore(false);
    }
  };

  if (!items) return <Skeleton width="100%" height={120} radius={10} />;
  if (items.length === 0) return <p className="muted">Nessuna attività registrata.</p>;

  return (
    <>
      <ol className="activity" data-testid="activity">
        {items.map((a) => (
          <li key={a._id} className="activity-item">
            <span className="activity-icon">
              <Icon name={ACTIVITY_ICONS[a.type] || 'info'} size={15} />
            </span>
            <span className="grow">{a.text}</span>
            <time dateTime={a.createdAt} className="muted">{timeAgo(a.createdAt)}</time>
          </li>
        ))}
      </ol>
      {hasMore && (
        <button className="btn btn-sm" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? 'Caricamento…' : 'Mostra attività precedenti'}
        </button>
      )}
    </>
  );
}
