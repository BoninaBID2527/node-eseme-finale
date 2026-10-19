// Intestazione di pagina: contesto (eyebrow), titolo, introduzione e azione principale.
// Sempre uguale in tutte le schermate, così si capisce subito dove ci si trova e cosa si può fare.
export default function PageHeader({ eyebrow, title, lead, actions, children, className = '' }) {
  return (
    <header className={`page-head ${className}`}>
      <div className="page-head-text">
        {eyebrow && <p className="eyebrow is-marked">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {lead && <p className="lead">{lead}</p>}
        {children}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
