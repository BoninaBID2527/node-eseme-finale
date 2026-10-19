import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import Board from '../components/Board';
import Chat from '../components/Chat';
import MembersPanel from '../components/MembersPanel';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { useSocketEvent } from '../context/RealtimeContext';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../utils';

function ReportModal({ projectId, onClose }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/projects/${projectId}/report`, { reason });
      toast('Segnalazione inviata agli amministratori', 'success');
      onClose();
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  };

  return (
    <Modal title="Segnala progetto" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          Perché vuoi segnalarlo?
          <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={500} autoFocus />
        </label>
        <div className="modal-actions">
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Annulla
          </button>
          <button className="btn btn-primary" disabled={busy}>
            Invia segnalazione
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function ProjectPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [state, setState] = useState(null); // { project, isOwner, isMember }
  const [error, setError] = useState('');
  const [tab, setTab] = useState('chat');
  const [reporting, setReporting] = useState(false);

  const load = useCallback(() => {
    api
      .get(`/projects/${id}`)
      .then((data) => {
        setState(data);
        setError('');
      })
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    setState(null);
    load();
  }, [load]);

  // Eventi live sui membri: aggiorna la lista, oppure esci se sei stato rimosso.
  useSocketEvent('member:joined', useCallback((e) => e.projectId === id && load(), [id, load]));
  useSocketEvent(
    'member:removed',
    useCallback(
      (e) => {
        if (e.projectId !== id) return;
        if (e.userId === user._id) {
          toast('Sei stato rimosso dal progetto', 'info');
          navigate('/dashboard');
        } else {
          load();
        }
      },
      [id, user._id, load, navigate, toast]
    )
  );

  if (error) {
    return (
      <div className="page">
        <div className="empty card">
          <h3>{error}</h3>
          <Link className="btn" to="/catalog">
            Torna al catalogo
          </Link>
        </div>
      </div>
    );
  }
  if (!state) return <div className="page muted">Caricamento…</div>;

  const { project, isOwner, isMember } = state;
  const isAdmin = user.role === 'admin';
  const archived = project.status === 'archived';
  const hidden = project.status === 'hidden';
  const people = [project.owner, ...project.members];

  const setProject = (updated) => setState({ ...state, project: { ...project, ...updated } });

  const toggleArchive = async () => {
    try {
      const data = await api.patch(`/projects/${id}/archive`, { archived: !archived });
      setProject({ status: data.project.status });
      toast(archived ? 'Progetto riattivato' : 'Progetto archiviato', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const toggleHidden = async () => {
    try {
      const data = await api.patch(`/admin/projects/${id}/hide`, { hidden: !hidden });
      setProject({ status: data.project.status });
      toast(hidden ? 'Progetto di nuovo visibile' : 'Progetto nascosto dal catalogo', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const remove = async () => {
    if (!window.confirm(`Eliminare definitivamente "${project.title}" con tutti i suoi task e messaggi?`)) return;
    try {
      await api.delete(`/projects/${id}`);
      toast('Progetto eliminato', 'success');
      navigate('/dashboard');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="page page-wide">
      {archived && <div className="banner banner-warn">Questo progetto è archiviato: la bacheca è in sola lettura.</div>}
      {hidden && <div className="banner banner-danger">Questo progetto è stato nascosto da un amministratore.</div>}

      <header className="project-head card">
        <div className="project-cover" style={project.coverImage ? { backgroundImage: `url(${project.coverImage})` } : undefined} />
        <div className="project-info">
          <div className="card-meta">
            <span className="chip chip-category">{project.category}</span>
            <span className="muted">{project.visibility === 'public' ? 'Pubblico' : 'Privato'}</span>
            <span className="muted">· creato il {formatDate(project.createdAt)}</span>
          </div>
          <h1>{project.title}</h1>
          {project.description && <p className="project-desc">{project.description}</p>}
          <div className="chips">
            {project.technologies.map((t) => (
              <span key={t} className="chip">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="project-actions">
          {isOwner && (
            <>
              <Link className="btn" to={`/projects/${id}/edit`}>
                Modifica
              </Link>
              <button className="btn" onClick={toggleArchive} disabled={hidden}>
                {archived ? 'Riattiva' : 'Archivia'}
              </button>
              <button className="btn btn-danger-ghost" onClick={remove}>
                Elimina
              </button>
            </>
          )}
          {!isOwner && (
            <button className="btn" onClick={() => setReporting(true)}>
              Segnala
            </button>
          )}
          {isAdmin && (
            <button className="btn" onClick={toggleHidden}>
              {hidden ? 'Rendi visibile' : 'Nascondi (admin)'}
            </button>
          )}
        </div>
      </header>

      <div className="workspace">
        <section className="workspace-main">
          <h2>Bacheca</h2>
          {isMember ? (
            <Board project={project} people={people} readOnly={archived} />
          ) : (
            <div className="empty card">
              <h3>La bacheca è riservata ai membri</h3>
              <p className="muted">Chiedi a {project.owner.name} di invitarti usando la tua email.</p>
            </div>
          )}
        </section>

        <aside className="workspace-side card">
          <div className="tabs" role="tablist">
            {isMember && (
              <button role="tab" className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>
                Chat
              </button>
            )}
            <button role="tab" className={tab === 'members' || !isMember ? 'active' : ''} onClick={() => setTab('members')}>
              Membri ({people.length})
            </button>
          </div>
          {isMember && tab === 'chat' ? (
            <Chat projectId={project._id} />
          ) : (
            <MembersPanel project={project} isOwner={isOwner} onChange={setProject} />
          )}
        </aside>
      </div>

      {reporting && <ReportModal projectId={id} onClose={() => setReporting(false)} />}
    </div>
  );
}
