import { Link } from 'react-router-dom';
import Avatar from './Avatar';
import { ProgressBar, ProjectStatusBadge, VisibilityLabel } from './Badges';
import ProjectCover from './ProjectCover';
import { formatDate } from '../utils';

// Card del catalogo e dei miei progetti. Tutta la card è cliccabile tramite il link del titolo.
// `featured` (solo catalogo, schermi larghi): la prima card occupa due colonne con la copertina a fianco del testo.
export default function ProjectCard({ project, showProgress = false, featured = false }) {
  const technologies = project.technologies || [];
  const visible = featured ? 4 : 3;
  return (
    <article className={`project-card${featured ? ' is-featured' : ''}`}>
      <div className="project-card-media">
        <ProjectCover project={project} tall={featured} />
        <div className="cover-badges">
          <span className="cover-tag">{project.category}</span>
          <ProjectStatusBadge status={project.status} />
        </div>
      </div>
      <div className="project-card-body">
        {showProgress && (
          <div className="project-card-meta">
            <VisibilityLabel visibility={project.visibility} />
          </div>
        )}
        <h3>
          <Link to={`/projects/${project._id}`} className="stretched-link">
            {project.title}
          </Link>
        </h3>
        {project.description && <p className={featured ? 'clamp-3' : 'clamp-2'}>{project.description}</p>}
        {technologies.length > 0 && (
          <ul className="chips" aria-label="Tecnologie">
            {technologies.slice(0, visible).map((t) => (
              <li key={t} className="chip">
                {t}
              </li>
            ))}
            {technologies.length > visible && <li className="chip chip-more">+{technologies.length - visible}</li>}
          </ul>
        )}
        {showProgress && project.progress && <ProgressBar done={project.progress.done} total={project.progress.total} />}
        <div className="project-card-foot">
          {project.owner?.name && (
            <>
              <Avatar name={project.owner.name} size={24} />
              <span className="truncate">{project.owner.name}</span>
            </>
          )}
          <time dateTime={project.createdAt} className="muted">
            {formatDate(project.createdAt)}
          </time>
        </div>
      </div>
    </article>
  );
}
