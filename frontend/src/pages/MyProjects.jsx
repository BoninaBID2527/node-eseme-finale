import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, toQuery } from '../api';
import Icon from '../components/Icon';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import ProjectCard from '../components/ProjectCard';
import { GridSkeleton } from '../components/Skeleton';
import { EmptyState, ErrorState } from '../components/StateMessage';
import { useRealtime } from '../context/RealtimeContext';
import useAsync from '../hooks/useAsync';
import useDebouncedValue from '../hooks/useDebouncedValue';
import useDocumentTitle from '../hooks/useDocumentTitle';
import useUrlFilters from '../hooks/useUrlFilters';

const DEFAULTS = { role: 'all', status: 'all', q: '', page: '1' };
const ROLES = [
  { value: 'all', label: 'Tutti' },
  { value: 'owner', label: 'Creati da me' },
  { value: 'member', label: 'Come membro' },
];

export default function MyProjects() {
  useDocumentTitle('I miei progetti');
  const { resyncKey } = useRealtime();
  const { filters, setFilter, reset, active } = useUrlFilters(DEFAULTS);

  const [text, setText] = useState(filters.q);
  const debounced = useDebouncedValue(text, 300);
  useEffect(() => {
    if (debounced !== filters.q) setFilter('q', debounced);
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  const query = toQuery({ ...filters, page: filters.page === '1' ? '' : filters.page, limit: 12 });
  const { data, loading, error, reload } = useAsync(() => api.get(`/projects/mine${query}`), [query, resyncKey]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Lavoro"
        title="I miei progetti"
        lead="I progetti che hai creato e quelli in cui lavori con altri membri."
        actions={
          <Link to="/projects/new" className="btn btn-primary">
            <Icon name="plus" size={18} /> Nuovo progetto
          </Link>
        }
      />

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Filtra per ruolo">
          {ROLES.map((r) => (
            <button key={r.value} aria-pressed={filters.role === r.value} onClick={() => setFilter('role', r.value)}>
              {r.label}
            </button>
          ))}
        </div>
        <div className="field toolbar-field">
          <label htmlFor="mp-status" className="visually-hidden">Stato</label>
          <select id="mp-status" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="all">Tutti gli stati</option>
            <option value="active">Attivi</option>
            <option value="archived">Archiviati</option>
            <option value="hidden">Oscurati</option>
          </select>
        </div>
        <div className="search toolbar-search">
          <Icon name="search" size={18} />
          <input type="search" aria-label="Cerca per titolo" placeholder="Cerca per titolo" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        {active > 0 && (
          <button className="btn btn-sm" onClick={() => { reset(); setText(''); }}>
            <Icon name="x" size={14} /> Azzera
          </button>
        )}
      </div>

      {error && <ErrorState message={error} onRetry={reload} />}
      {!error && !data && loading && <GridSkeleton count={6} />}
      {!error && data && data.projects.length === 0 && (
        <EmptyState
          icon="folder"
          title={active > 0 ? 'Nessun progetto corrisponde ai filtri' : 'Non hai ancora progetti'}
          text={active > 0 ? 'Prova a cambiare i filtri.' : 'Crea un progetto per iniziare, oppure cerca nel catalogo un team a cui unirti.'}
          action={
            active > 0 ? (
              <button className="btn" onClick={() => { reset(); setText(''); }}>Azzera i filtri</button>
            ) : (
              <Link className="btn btn-primary" to="/projects/new">Crea un progetto</Link>
            )
          }
        />
      )}
      {!error && data && data.projects.length > 0 && (
        <>
          <p className="results-count" aria-live="polite" role="status">
            <strong className="tabular">{data.total}</strong> {data.total === 1 ? 'progetto' : 'progetti'}
            {active > 0 && ' con i filtri scelti'}
          </p>
          <div className="grid stagger" aria-busy={loading} style={{ opacity: loading ? 0.55 : 1, transition: 'opacity 150ms' }}>
            {data.projects.map((p) => (
              <ProjectCard key={p._id} project={p} showProgress />
            ))}
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={(p) => setFilter('page', String(p))} />
        </>
      )}
    </div>
  );
}
