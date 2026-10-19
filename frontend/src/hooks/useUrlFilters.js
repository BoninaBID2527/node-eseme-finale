import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

// Tiene i filtri di una pagina nell'URL (?q=...&page=2): si possono condividere, e il tasto Indietro funziona.
// `defaults` deve essere un oggetto costante definito fuori dal componente.
export default function useUrlFilters(defaults, { keep = [] } = {}) {
  const [params, setParams] = useSearchParams();

  const filters = {};
  Object.keys(defaults).forEach((key) => {
    filters[key] = params.get(key) ?? defaults[key];
  });

  const setFilter = useCallback(
    (key, value) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === '' || value === null || value === undefined || value === defaults[key]) next.delete(key);
          else next.set(key, value);
          if (key !== 'page') next.delete('page'); // cambiando un filtro si riparte dalla prima pagina
          return next;
        },
        { replace: true }
      ),
    [setParams, defaults]
  );

  const reset = useCallback(
    () =>
      setParams(
        (prev) => {
          const next = new URLSearchParams();
          keep.forEach((key) => prev.get(key) && next.set(key, prev.get(key)));
          return next;
        },
        { replace: true }
      ),
    [setParams, keep] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const active = Object.keys(defaults).filter((key) => key !== 'page' && !keep.includes(key) && filters[key] !== defaults[key]).length;
  return { filters, setFilter, reset, active };
}
