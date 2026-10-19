import { useEffect, useState } from 'react';
import { api, toQuery } from '../api';
import ProjectCard from '../components/ProjectCard';
import { CATEGORIES } from '../utils';

const EMPTY_FILTERS = { q: '', category: '', technology: '', from: '', to: '' };

export default function Catalog() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState('');

  // Ricarica il catalogo ad ogni cambio di filtro (con una breve attesa mentre si scrive).
  useEffect(() => {
    const timer = setTimeout(() => {
      api
        .get(`/projects/public${toQuery(filters)}`)
        .then((data) => {
          setProjects(data.projects);
          setError('');
        })
        .catch((err) => setError(err.message));
    }, 250);
    return () => clearTimeout(timer);
  }, [filters]);

  const update = (field) => (e) => setFilters({ ...filters, [field]: e.target.value });
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Catalogo progetti</h1>
          <p className="muted">Scopri i progetti aperti e trova un team in cui entrare.</p>
        </div>
      </header>

      <div className="filters card">
        <label className="grow">
          Cerca
          <input type="search" placeholder="Titolo o descrizione" value={filters.q} onChange={update('q')} />
        </label>
        <label>
          Categoria
          <select value={filters.category} onChange={update('category')}>
            <option value="">Tutte</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Tecnologia
          <input placeholder="es. React" value={filters.technology} onChange={update('technology')} />
        </label>
        <label>
          Creati dal
          <input type="date" value={filters.from} onChange={update('from')} />
        </label>
        <label>
          al
          <input type="date" value={filters.to} onChange={update('to')} />
        </label>
        {hasFilters && (
          <button className="btn" onClick={() => setFilters(EMPTY_FILTERS)}>
            Azzera
          </button>
        )}
      </div>

      {error && <p className="form-error">{error}</p>}
      {!projects && !error && <p className="muted">Caricamento…</p>}
      {projects && projects.length === 0 && (
        <div className="empty card">
          <h3>Nessun progetto trovato</h3>
          <p className="muted">{hasFilters ? 'Prova a cambiare i filtri.' : 'Non ci sono ancora progetti pubblici.'}</p>
        </div>
      )}
      <div className="grid">
        {projects?.map((p) => (
          <ProjectCard key={p._id} project={p} />
        ))}
      </div>
    </div>
  );
}
