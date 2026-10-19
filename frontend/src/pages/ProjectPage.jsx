import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import Avatar from '../components/Avatar';
import { ProjectStatusBadge, VisibilityLabel } from '../components/Badges';
import Board from '../components/Board';
import Chat from '../components/Chat';
import Icon from '../components/Icon';
import MembersTab from '../components/MembersTab';
import OverviewTab from '../components/OverviewTab';
import ProjectCover from '../components/ProjectCover';
import ReportModal from '../components/ReportModal';
import SettingsTab from '../components/SettingsTab';
import { Skeleton } from '../components/Skeleton';
import { ErrorState } from '../components/StateMessage';
import Tabs from '../components/Tabs';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useRealtime, useSocketEvent } from '../context/RealtimeContext';
import { useToast } from '../context/ToastContext';
import useAsync from '../hooks/useAsync';
import useDocumentTitle from '../hooks/useDocumentTitle';
import useProjectTasks from '../hooks/useProjectTasks';
import { errorMessage } from '../utils';

export default function ProjectPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { resyncKey } = useRealtime();
  const [params, setParams] = useSearchParams();
  const [reporting, setReporting] = useState(false);

  const { data, error, reload, setData } = useAsync(() => api.get(`/projects/${id}`), [id]);
  const project = data?.project;
  const isOwner = data?.isOwner ?? false;
  const isMember = data?.isMember ?? false;
  const isAdmin = user.role === 'admin';
  const writable = project?.status === 'active';
  useDocumentTitle(project?.title);

  // I task servono a panoramica e bacheca: li carichiamo una volta sola per i membri.
  const tasksApi = useProjectTasks(id, isMember && project?.status !== undefined);

  // Merge dei campi aggiornati (da modifiche locali o da eventi live) nello stato del progetto.
  const applyUpdate = useCallback((changes) => setData((d) => d && { ...d, project: { ...d.project, ...changes } }), [setData]);

  // ---- Eventi live del progetto ----
  useSocketEvent('project:updated', useCallback((p) => {
    if (p._id !== id) return;
    applyUpdate(p);
    if (p.status === 'hidden' && !isOwner && !isAdmin) {
      toast('Il progetto è stato oscurato da un amministratore', 'info');
      navigate('/projects');
    }
  }, [id, applyUpdate, isOwner, isAdmin, navigate, toast]));
  useSocketEvent('project:deleted', useCallback((e) => {
    if (e.projectId !== id) return;
    toast(`Il progetto "${e.title}" è stato eliminato`, 'info');
    navigate('/projects');
  }, [id, navigate, toast]));
  useSocketEvent('member:joined', useCallback((e) => e.projectId === id && reload({ silent: true }), [id, reload]));
  useSocketEvent('member:removed', useCallback((e) => {
    if (e.projectId !== id) return;
    if (e.userId === user._id) {
      toast('Non fai più parte di questo progetto', 'info');
      navigate('/projects');
    } else reload({ silent: true });
  }, [id, user._id, reload, navigate, toast]));
  useEffect(() => {
    if (resyncKey) reload({ silent: true });
  }, [resyncKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Schede disponibili in base ai permessi ----
  const tabs = useMemo(() => {
    const list = [{ id: 'overview', label: 'Panoramica' }];
    if (isMember) list.push({ id: 'board', label: 'Bacheca', count: tasksApi.tasks?.length });
    list.push({ id: 'members', label: 'Membri', count: project ? project.members.length + 1 : undefined });
    if (isMember) list.push({ id: 'chat', label: 'Chat' });
    if (isOwner) list.push({ id: 'settings', label: 'Impostazioni' });
    return list;
  }, [isMember, isOwner, project, tasksApi.tasks]);

  const requested = params.get('tab');
  const tab = tabs.some((t) => t.id === requested) ? requested : isMember ? 'board' : 'overview';
  const setTab = (next) => setParams((prev) => { const p = new URLSearchParams(prev); p.set('tab', next); p.delete('task'); return p; }, { replace: true });
  const clearTaskParam = useCallback(() => setParams((prev) => { const p = new URLSearchParams(prev); p.delete('task'); return p; }, { replace: true }), [setParams]);

  // La risposta di PUT/PATCH contiene proprietario e membri come semplici id (non "popolati"):
  // si fondono solo i campi del progetto, poi si ricarica la versione completa dal server.
  const onSettingsUpdated = (changes) => {
    const { owner, members, ...fields } = changes; // eslint-disable-line no-unused-vars
    applyUpdate(fields);
    reload({ silent: true });
  };

  const toggleHidden = async () => {
    const hide = project.status !== 'hidden';
    const ok = await confirm({
      title: hide ? 'Oscurare il progetto?' : 'Rendere di nuovo visibile il progetto?',
      message: hide
        ? 'Il progetto esce dal catalogo, i membri (tranne il proprietario) perdono l\'accesso e le segnalazioni aperte vengono chiuse come gestite.'
        : 'Il progetto torna attivo e i membri riottengono l\'accesso.',
      confirmLabel: hide ? 'Oscura' : 'Rendi visibile',
      danger: hide,
    });
    if (!ok) return;
    try {
      const res = await api.patch(`/admin/projects/${id}/hide`, { hidden: hide });
      applyUpdate({ status: res.project.status });
      toast(hide ? 'Progetto oscurato' : 'Progetto di nuovo visibile', 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  if (error) {
    return (
      <div className="page">
        <ErrorState message={error} onRetry={reload} />
        <p className="center muted"><Link to="/catalog">Torna al catalogo</Link></p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="page" aria-busy="true">
        <Skeleton height={150} width="100%" radius={12} />
        <div style={{ height: 24 }} />
        <Skeleton height={300} width="100%" radius={12} />
      </div>
    );
  }

  const people = [project.owner, ...project.members];

  return (
    <div className="page page-wide">
      {project.status === 'archived' && (
        <div className="banner banner-warn" role="status">
          <Icon name="archive" size={18} />
          <span>Questo progetto è archiviato: è in sola lettura (task, chat, inviti e modifiche sono bloccati).</span>
          {isOwner && <button className="btn btn-sm" onClick={() => setTab('settings')}>Riattiva</button>}
        </div>
      )}
      {project.status === 'hidden' && (
        <div className="banner banner-danger" role="status">
          <Icon name="eye-off" size={18} />
          <span>Questo progetto è stato oscurato da un amministratore: non è visibile nel catalogo e non è modificabile.</span>
        </div>
      )}

      <header className="project-head">
        <ProjectCover project={project} className="project-head-cover" />
        <div className="project-head-info">
          <div className="project-card-meta">
            <span className="eyebrow">{project.category}</span>
            <VisibilityLabel visibility={project.visibility} />
            <ProjectStatusBadge status={project.status} />
          </div>
          <h1>{project.title}</h1>
          <div className="project-head-people">
            <ul className="avatar-stack" aria-label="Membri">
              {people.slice(0, 5).map((p) => (
                <li key={p._id}><Avatar name={p.name} size={30} /></li>
              ))}
            </ul>
            <span className="muted">
              di <strong>{project.owner.name}</strong> · {people.length} {people.length === 1 ? 'persona' : 'persone'}
            </span>
          </div>
        </div>
        <div className="project-head-actions">
          {!isOwner && (
            <button className="btn" onClick={() => setReporting(true)}>
              <Icon name="flag" size={16} /> Segnala
            </button>
          )}
          {isAdmin && (
            <button className="btn btn-dark" onClick={toggleHidden}>
              <Icon name={project.status === 'hidden' ? 'eye' : 'eye-off'} size={16} /> {project.status === 'hidden' ? 'Rendi visibile' : 'Oscura'}
            </button>
          )}
        </div>
      </header>

      <Tabs tabs={tabs} value={tab} onChange={setTab} label="Sezioni del progetto" idPrefix="pt" className="project-tabs" />

      <div role="tabpanel" id={`pt-panel-${tab}`} aria-labelledby={`pt-${tab}`} className="tab-panel" tabIndex={-1}>
        {tab === 'overview' && <OverviewTab project={project} isMember={isMember} tasks={tasksApi.tasks} onOpenTab={setTab} />}
        {tab === 'board' && (
          <Board
            project={project}
            people={people}
            readOnly={!writable}
            tasksApi={tasksApi}
            openTaskId={params.get('task')}
            onTaskOpened={clearTaskParam}
          />
        )}
        {tab === 'members' && (
          <MembersTab
            project={project}
            isOwner={isOwner}
            isMember={isMember}
            writable={writable}
            onChanged={() => reload({ silent: true })}
          />
        )}
        {tab === 'chat' && <Chat project={project} readOnly={!writable} />}
        {tab === 'settings' && <SettingsTab project={project} onUpdated={onSettingsUpdated} />}
      </div>

      {reporting && <ReportModal project={project} onClose={() => setReporting(false)} />}
    </div>
  );
}
