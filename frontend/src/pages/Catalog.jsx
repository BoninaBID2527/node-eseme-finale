import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, toQuery } from '../api';
import PageHeader from '../components/PageHeader';
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
import { formatDate } from '../utils';

const DEFAULTS = { q: '', category: '', technology: '', from: '', to: '', sort: 'recent', page: '1' };
// 8 card: su tre colonne la prima (in evidenza) occupa due celle e la griglia si riempie senza buchi.
const PAGE_SIZE = 8;

export default function Catalog() {
  useDocumentTitle('Catalogo');
  const { user } = useAuth();
  const { filters, setFilter, reset, active } = useUrlFilters(DEFAULTS);
  const [moreOpen, setMoreOpen] = useState(Boolean(filters.from || filters.to));

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
  const dateCount = (filters.from ? 1 : 0) + (filters.to ? 1 : 0);
  const clearAll = () => {
    reset();
    setText('');
  };

  // Filtri attivi mostrati come chip rimovibili (l'ordinamento non è un filtro: si legge nel selettore).
  const chips = [
    filters.q && { key: 'q', label: `“${filters.q}”`, clear: () => { setText(''); setFilter('q', ''); } },
    filters.category && { key: 'category', label: filters.category, clear: () => setFilter('category', '') },
    filters.technology && { key: 'technology', label: filters.technology, clear: () => setFilter('technology', '') },
    filters.from && { key: 'from', label: `Dal ${formatDate(filters.from)}`, clear: () => setFilter('from', '') },
    filters.to && { key: 'to', label: `Fino al ${formatDate(filters.to)}`, clear: () => setFilter('to', '') },
  ].filter(Boolean);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Esplora"
        title="Catalogo progetti"
        lead="Cerca per tema o tecnologia e trova il team giusto. Per entrare in un progetto chiedi un invito al suo proprietario."
        actions={
          user ? (
            <Link to="/projects/new" className="btn btn-primary">
              <Icon name="plus" size={18} /> Nuovo progetto
            </Link>
          ) : (
            <Link to="/register" className="btn btn-primary">
              Crea un account
            </Link>
          )
        }
      />

      <section className="catalog-filters" aria-label="Filtri del catalogo">
        <div className="catalog-search">
          <label htmlFor="catalog-q" className="visually-hidden">Cerca un progetto</label>
          <div className="search search-lg">
            <Icon name="search" size={20} />
            <input id="catalog-q" type="search" placeholder="Cerca per titolo o descrizione…" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
        </div>

        <div className="catalog-pills">
          <span className="eyebrow" id="catalog-category-label">Categoria</span>
          <div className="pills" role="group" aria-labelledby="catalog-category-label">
            <button className="pill-btn" aria-pressed={!filters.category} onClick={() => setFilter('category', '')}>
              Tutte
            </button>
            {facets.data?.categories.map((c) => (
              <button key={c.name} className="pill-btn" aria-pressed={filters.category === c.name} onClick={() => setFilter('category', filters.category === c.name ? '' : c.name)}>
                {c.name} <small>{c.count}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="catalog-row">
          <div className="field field-inline">
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
          <button className="btn btn-sm catalog-more" aria-expanded={moreOpen} aria-controls="catalog-dates" onClick={() => setMoreOpen(!moreOpen)}>
            <Icon name="sliders" size={16} /> Più filtri
            {dateCount > 0 && <span className="catalog-more-count" aria-label={`${dateCount} attivi`}>{dateCount}</span>}
            <Icon name="chevron-down" size={14} className={`catalog-chevron${moreOpen ? ' is-open' : ''}`} />
          </button>
        </div>

        {moreOpen && (
          <div className="catalog-dates" id="catalog-dates">
            <div className="field">
              <label htmlFor="catalog-from">Creati dal</label>
              <input id="catalog-from" type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter('from', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="catalog-to">Fino al</label>
              <input id="catalog-to" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter('to', e.target.value)} />
            </div>
          </div>
        )}
      </section>

      {chips.length > 0 && (
        <ul className="catalog-active" aria-label="Filtri attivi">
          {chips.map((c) => (
            <li key={c.key}>
              <button className="filter-chip" onClick={c.clear} aria-label={`Rimuovi il filtro: ${c.label}`}>
                {c.label}
                <Icon name="x" size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="results-bar">
        <p aria-live="polite" role="status">
          {data ? (
            <>
              <strong className="tabular">{data.total}</strong> {data.total === 1 ? 'progetto' : 'progetti'}
              {active > 0 ? ' con i filtri scelti' : ' pubblici'}
            </>
          ) : (
            ' '
          )}
        </p>
        <div className="results-tools">
          {active > 0 && (
            <button className="btn btn-sm btn-ghost" onClick={clearAll}>
              <Icon name="x" size={14} /> Azzera i filtri
            </button>
          )}
          <div className="field-inline">
            <label htmlFor="catalog-sort">Ordina per</label>
            <select id="catalog-sort" value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)}>
              <option value="recent">Più recenti</option>
              <option value="oldest">Meno recenti</option>
              <option value="title">Titolo (A–Z)</option>
            </select>
          </div>
        </div>
      </div>
      {invalidRange && <p className="form-alert">La data iniziale è successiva a quella finale: non verrà trovato nessun progetto.</p>}

      {error && <ErrorState message={error} onRetry={reload} />}
      {!error && !data && <GridSkeleton count={PAGE_SIZE} className="catalog-grid" featured />}
      {!error && data && data.projects.length === 0 && (
        <EmptyState
          icon="search"
          title="Nessun progetto trovato"
          text={
            active > 0
              ? 'Nessun progetto pubblico corrisponde a questa combinazione di filtri. Prova ad allargare la ricerca o a toglierne qualcuno.'
              : 'Non ci sono ancora progetti pubblici: il primo potresti essere tu.'
          }
          action={
            <div className="state-actions">
              {active > 0 && (
                <button className="btn" onClick={clearAll}>
                  Azzera i filtri
                </button>
              )}
              <Link className="btn btn-primary" to={user ? '/projects/new' : '/register'}>
                {user ? 'Crea un progetto' : 'Crea un account'}
              </Link>
            </div>
          }
        />
      )}
      {!error && data && data.projects.length > 0 && (
        <>
          <div className="catalog-grid stagger" aria-busy={loading} style={{ opacity: loading ? 0.55 : 1, transition: 'opacity 150ms' }}>
            {data.projects.map((p, i) => (
              <ProjectCard key={p._id} project={p} featured={i === 0 && data.projects.length >= PAGE_SIZE} />
            ))}
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={(p) => setFilter('page', String(p))} />
        </>
      )}
    </div>
  );
}
