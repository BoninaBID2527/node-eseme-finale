import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../utils';

// Carica dati asincroni con stati { data, loading, error } e possibilità di riprovare.
// `loader` viene richiamato quando cambiano le dipendenze; le risposte vecchie vengono ignorate.
export default function useAsync(loader, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const counter = useRef(0);

  const run = useCallback(
    ({ silent = false } = {}) => {
      const id = ++counter.current;
      if (!silent) setState((s) => ({ ...s, loading: true, error: '' }));
      return loader()
        .then((data) => id === counter.current && setState({ data, loading: false, error: '' }))
        .catch((err) => id === counter.current && setState((s) => ({ data: silent ? s.data : null, loading: false, error: errorMessage(err) })));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps
  );

  useEffect(() => {
    run();
  }, [run]);

  return { ...state, reload: run, setData: (updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })) };
}
