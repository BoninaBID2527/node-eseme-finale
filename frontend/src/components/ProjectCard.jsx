import { Link } from 'react-router-dom';
import Avatar from './Avatar';
import { ProgressBar, ProjectStatusBadge, VisibilityLabel } from './Badges';
import ProjectCover from './ProjectCover';
import { formatDate } from '../utils';

// Card del catalogo e dei miei progetti. Tutta la card è cliccabile tramite il link del titolo.
export default function ProjectCard({ project, showProgress = false }) {
  const technologies = project.technologies || [];
  return (
    <article className="project-card">
      <ProjectCover project={project} />
      <div className="project-card-body">
        <div className="project-card-meta">
          <span className="eyebrow">{project.category}</span>
          <ProjectStatusBadge status={project.status} />
          {showProgress && <VisibilityLabel visibility={project.visibility} />}
        </div>
        <h3>
          <Link to={`/projects/${project._id}`} className="stretched-link">
            {project.title}
          </Link>
        </h3>
        {project.description && <p className="clamp-2">{project.description}</p>}
        {technologies.length > 0 && (
          <ul className="chips" aria-label="Tecnologie">
            {technologies.slice(0, 3).map((t) => (
              <li key={t} className="chip">
                {t}
              </li>
            ))}
            {technologies.length > 3 && <li className="chip chip-more">+{technologies.length - 3}</li>}
          </ul>
        )}
        {showProgress && project.progress && <ProgressBar done={project.progress.done} total={project.progress.total} />}
        <div className="project-card-foot">
          {project.owner?.name && (
            <>
              <Avatar name={project.owner.name} size={22} />
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
