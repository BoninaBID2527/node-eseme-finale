import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, toQuery } from '../api';
import Icon from '../components/Icon';
import Pagination from '../components/Pagination';
import ProjectCard from '../components/ProjectCard';
import { GridSkeleton } from '../components/Skeleton';
import { EmptyState, ErrorState } from '../components/StateMessage';
import { useAuth } from '../context/AuthContext';
import useAsync from '../hooks/useAsync';
import useDebouncedValue from '../hooks/useDebouncedValue';
import useDocumentTitle from '../hooks/useDocumentTitle';
import useUrlFilters from '../hooks/useUrlFilters';

const DEFAULTS = { q: '', category: '', technology: '', from: '', to: '', sort: 'recent', page: '1' };
const PAGE_SIZE = 9;

export default function Catalog() {
  useDocumentTitle('Catalogo');
  const { user } = useAuth();
  const { filters, setFilter, reset, active } = useUrlFilters(DEFAULTS);

  // La ricerca testuale viene inviata al server solo quando si smette di scrivere.
  const [text, setText] = useState(filters.q);
  const debouncedText = useDebouncedValue(text, 300);
  useEffect(() => {
    if (debouncedText !== filters.q) setFilter('q', debouncedText);
  }, [debouncedText]); // eslint-disable-line react-hooks/exhaustive-deps
  // Il testo si allinea all'URL solo per cambi esterni (azzera, tasto Indietro), mai mentre si sta scrivendo.
  useEffect(() => {
    if (filters.q !== debouncedText) setText(filters.q);
  }, [filters.q]); // eslint-disable-line react-hooks/exhaustive-deps

  const query = toQuery({ ...filters, page: filters.page === '1' ? '' : filters.page, limit: PAGE_SIZE });
  const { data, loading, error, reload } = useAsync(() => api.get(`/projects/public${query}`), [query]);
  const facets = useAsync(() => api.get('/projects/public/filters'), []);

  const invalidRange = filters.from && filters.to && filters.from > filters.to;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">Catalogo progetti</h1>
          <p className="page-lead">
            Esplora i progetti pubblici: cerca per tema o tecnologia e trova il team giusto. Per entrare in un progetto chiedi un invito al suo proprietario.
          </p>
        </div>
        {user ? (
          <Link to="/projects/new" className="btn btn-primary">
            <Icon name="plus" size={18} /> Nuovo progetto
          </Link>
        ) : (
          <Link to="/register" className="btn btn-primary">
            Crea un account
          </Link>
        )}
      </header>

      <section className="filters card" aria-label="Filtri del catalogo">
        <div className="field filters-search">
          <label htmlFor="catalog-q">Cerca</label>
          <div className="search">
            <Icon name="search" size={18} />
            <input id="catalog-q" type="search" placeholder="Titolo o descrizione" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="catalog-category">Categoria</label>
          <select id="catalog-category" value={filters.category} onChange={(e) => setFilter('category', e.target.value)}>
            <option value="">Tutte</option>
            {facets.data?.categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.count})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="catalog-tech">Tecnologia</label>
          <select id="catalog-tech" value={filters.technology} onChange={(e) => setFilter('technology', e.target.value)}>
            <option value="">Tutte</option>
            {facets.data?.technologies.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name} ({t.count})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="catalog-from">Creati dal</label>
          <input id="catalog-from" type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter('from', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="catalog-to">Fino al</label>
          <input id="catalog-to" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter('to', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="catalog-sort">Ordina per</label>
          <select id="catalog-sort" value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)}>
            <option value="recent">Più recenti</option>
            <option value="oldest">Meno recenti</option>
            <option value="title">Titolo (A–Z)</option>
          </select>
        </div>
      </section>

      <div className="results-bar">
        <p aria-live="polite" role="status">
          {data ? (
            <>
              <strong className="tabular">{data.total}</strong> {data.total === 1 ? 'progetto' : 'progetti'}
              {active > 0 && ' con i filtri scelti'}
            </>
          ) : (
            ' '
          )}
        </p>
        {active > 0 && (
          <button className="btn btn-sm" onClick={() => { reset(); setText(''); }}>
            <Icon name="x" size={14} /> Azzera i filtri ({active})
          </button>
        )}
      </div>
      {invalidRange && <p className="form-alert">La data iniziale è successiva a quella finale: non verrà trovato nessun progetto.</p>}

      {error && <ErrorState message={error} onRetry={reload} />}
      {!error && !data && <GridSkeleton count={PAGE_SIZE} />}
      {!error && data && data.projects.length === 0 && (
        <EmptyState
          icon="search"
          title="Nessun progetto trovato"
          text={active > 0 ? 'Prova a cambiare o azzerare i filtri.' : 'Non ci sono ancora progetti pubblici. Crea il primo!'}
          action={
            active > 0 ? (
              <button className="btn" onClick={() => { reset(); setText(''); }}>Azzera i filtri</button>
            ) : (
              <Link className="btn btn-primary" to={user ? '/projects/new' : '/register'}>{user ? 'Crea un progetto' : 'Crea un account'}</Link>
            )
          }
        />
      )}
      {!error && data && data.projects.length > 0 && (
        <>
          <div className="grid" aria-busy={loading} style={{ opacity: loading ? 0.55 : 1, transition: 'opacity 150ms' }}>
            {data.projects.map((p) => (
              <ProjectCard key={p._id} project={p} />
            ))}
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={(p) => setFilter('page', String(p))} />
        </>
      )}
    </div>
  );
}
