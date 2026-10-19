// Segnaposto grigi durante il caricamento (l'animazione si ferma con prefers-reduced-motion).
export function Skeleton({ width, height = 16, radius = 6, className = '' }) {
  return <span className={`skeleton ${className}`} style={{ width, height, borderRadius: radius }} aria-hidden="true" />;
}

export function CardSkeleton() {
  return (
    <div className="project-card skeleton-card" aria-hidden="true">
      <Skeleton height={112} radius={0} width="100%" />
      <div className="project-card-body">
        <Skeleton width="40%" height={12} />
        <Skeleton width="85%" height={20} />
        <Skeleton width="100%" height={12} />
        <Skeleton width="70%" height={12} />
      </div>
    </div>
  );
}

export function RowsSkeleton({ rows = 4 }) {
  return (
    <div className="card list" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="list-row">
          <div className="grow">
            <Skeleton width="55%" height={16} />
            <Skeleton width="30%" height={12} className="mt-1" />
          </div>
          <Skeleton width={70} height={22} radius={11} />
        </div>
      ))}
    </div>
  );
}

export function GridSkeleton({ count = 6 }) {
  return (
    <div className="grid" role="status" aria-label="Caricamento in corso">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
