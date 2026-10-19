import { Link } from 'react-router-dom';
import { formatDate } from '../utils';

// Copertina: l'immagine caricata, oppure un gradiente con l'iniziale del titolo.
export default function ProjectCard({ project }) {
  const owner = project.owner?.name;
  return (
    <Link to={`/projects/${project._id}`} className="card project-card">
      <div className="cover" style={project.coverImage ? { backgroundImage: `url(${project.coverImage})` } : undefined}>
        {!project.coverImage && <span>{project.title[0]?.toUpperCase()}</span>}
        {project.status !== 'active' && <em className="badge badge-status">{project.status === 'archived' ? 'Archiviato' : 'Nascosto'}</em>}
      </div>
      <div className="card-body">
        <div className="card-meta">
          <span className="chip chip-category">{project.category}</span>
          <span className="muted">{project.visibility === 'public' ? 'Pubblico' : 'Privato'}</span>
        </div>
        <h3>{project.title}</h3>
        {project.description && <p className="clamp">{project.description}</p>}
        <div className="chips">
          {project.technologies?.slice(0, 4).map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
        </div>
        <div className="card-foot muted">
          {owner ? `di ${owner} · ` : ''}
          {formatDate(project.createdAt)}
        </div>
      </div>
    </Link>
  );
}
