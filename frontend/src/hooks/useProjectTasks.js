import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useRealtime, useSocketEvent } from '../context/RealtimeContext';
import { errorMessage } from '../utils';

// Task di un progetto, tenuti aggiornati in tempo reale: creazione, modifica, spostamento, riassegnazione ed
// eliminazione fatti da altri membri arrivano via Socket.IO. Dopo una riconnessione si ricarica tutto via REST.
export default function useProjectTasks(projectId, enabled) {
  const { resyncKey } = useRealtime();
  const [state, setState] = useState({ tasks: null, error: '' });

  const load = useCallback(
    () =>
      api
        .get(`/projects/${projectId}/tasks`)
        .then((data) => setState({ tasks: data.tasks, error: '' }))
        .catch((err) => setState((s) => ({ ...s, error: errorMessage(err) }))),
    [projectId]
  );

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load, resyncKey]);

  // Inserisce o sostituisce un task (gli eventi live arrivano anche per le azioni fatte da me).
  const upsert = useCallback(
    (task) => {
      if (task.project !== projectId) return;
      setState((s) => {
        if (!s.tasks) return s;
        const exists = s.tasks.some((t) => t._id === task._id);
        return { ...s, tasks: exists ? s.tasks.map((t) => (t._id === task._id ? task : t)) : [...s.tasks, task] };
      });
    },
    [projectId]
  );

  const remove = useCallback(
    (task) => {
      if (task.project !== projectId) return;
      setState((s) => ({ ...s, tasks: s.tasks && s.tasks.filter((t) => t._id !== task._id) }));
    },
    [projectId]
  );

  // Aggiornamento ottimistico locale (usato dal drag and drop e poi eventualmente annullato).
  const patch = useCallback(
    (taskId, changes) => setState((s) => ({ ...s, tasks: s.tasks && s.tasks.map((t) => (t._id === taskId ? { ...t, ...changes } : t)) })),
    []
  );

  useSocketEvent('task:created', upsert);
  useSocketEvent('task:updated', upsert);
  useSocketEvent('task:moved', upsert);
  useSocketEvent('task:deleted', remove);

  return { tasks: state.tasks, error: state.error, reload: load, upsert, remove, patch };
}
