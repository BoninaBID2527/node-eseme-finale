import Icon from './Icon';

// Elenco compatto delle pagine: 1 … 4 5 6 … 12
function pageList(page, pages) {
  const set = new Set([1, pages, page - 1, page, page + 1]);
  const list = [...set].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  return list.flatMap((p, i) => (i > 0 && p - list[i - 1] > 1 ? ['gap-' + p, p] : [p]));
}

export default function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Paginazione">
      <button className="btn btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Pagina precedente">
        <Icon name="chevron-left" size={16} />
      </button>
      {pageList(page, pages).map((p) =>
        typeof p === 'string' ? (
          <span key={p} className="pagination-gap" aria-hidden="true">
            …
          </span>
        ) : (
          <button key={p} className={`btn btn-sm${p === page ? ' is-current' : ''}`} onClick={() => onChange(p)} aria-current={p === page ? 'page' : undefined} aria-label={`Pagina ${p}`}>
            {p}
          </button>
        )
      )}
      <button className="btn btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Pagina successiva">
        <Icon name="chevron-right" size={16} />
      </button>
      <span className="pagination-info" aria-hidden="true">
        Pagina {page} di {pages}
      </span>
    </nav>
  );
}
