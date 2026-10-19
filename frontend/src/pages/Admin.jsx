import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, toQuery } from '../api';
import { ProjectStatusBadge } from '../components/Badges';
import Field from '../components/Field';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { RowsSkeleton } from '../components/Skeleton';
import { EmptyState, ErrorState } from '../components/StateMessage';
import Tabs from '../components/Tabs';
import { useConfirm } from '../context/ConfirmContext';
import { useRealtime, useSocketEvent } from '../context/RealtimeContext';
import { useToast } from '../context/ToastContext';
import useAsync from '../hooks/useAsync';
import useDebouncedValue from '../hooks/useDebouncedValue';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { errorMessage, formatDate, timeAgo } from '../utils';

const REPORT_STATUS = { open: 'Da esaminare', dismissed: 'Archiviata', actioned: 'Gestita' };

function DismissModal({ report, onClose, onDone }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch(`/admin/reports/${report._id}`, { status: 'dismissed', note });
      toast('Segnalazione archiviata', 'success');
      onDone();
      onClose();
    } catch (err) {
      toast(errorMessage(err), 'error');
      setBusy(false);
    }
  };

  return (
    <Modal title="Archivia la segnalazione" onClose={onClose} size="sm">
      <form className="form" onSubmit={submit}>
        <p className="muted">Nessuna azione verrà fatta sul progetto "{report.project?.title}".</p>
        <Field label="Nota interna" optional hint="Resta visibile solo agli amministratori.">
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} data-autofocus />
        </Field>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Annulla</button>
          <button className="btn btn-primary" disabled={busy}>Archivia</button>
        </div>
      </form>
    </Modal>
  );
}

function ReportsPanel({ onChanged }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { resyncKey } = useRealtime();
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const [dismissing, setDismissing] = useState(null);
  const { data, loading, error, reload } = useAsync(() => api.get(`/admin/reports${toQuery({ status, page })}`), [status, page, resyncKey]);

  useSocketEvent('notification:new', useCallback((n) => n.type === 'project_reported' && reload({ silent: true }), [reload]));

  const changeStatus = (value) => { setStatus(value); setPage(1); };
  const refresh = () => { reload({ silent: true }); onChanged(); };

  const hide = async (report) => {
    const ok = await confirm({
      title: `Oscurare "${report.project.title}"?`,
      message: 'Il progetto esce dal catalogo, i membri (tranne il proprietario) perdono l\'accesso e le segnalazioni aperte vengono chiuse come gestite. Potrai renderlo di nuovo visibile.',
      confirmLabel: 'Oscura il progetto',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.patch(`/admin/projects/${report.project._id}/hide`, { hidden: true });
      toast('Progetto oscurato', 'success');
      refresh();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const reopen = async (report) => {
    try {
      await api.patch(`/admin/reports/${report._id}`, { status: 'open' });
      refresh();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <div>
      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Stato delle segnalazioni">
          {[['open', 'Da esaminare'], ['actioned', 'Gestite'], ['dismissed', 'Archiviate'], ['all', 'Tutte']].map(([value, label]) => (
            <button key={value} aria-pressed={status === value} onClick={() => changeStatus(value)}>{label}</button>
          ))}
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={reload} />}
      {!error && !data && loading && <RowsSkeleton rows={3} />}
      {!error && data && data.reports.length === 0 && (
        <EmptyState
          icon="check-circle"
          title={status === 'open' ? 'Nessuna segnalazione da esaminare' : 'Nessuna segnalazione'}
          text="Quando un utente segnala un progetto lo vedrai qui in tempo reale."
        />
      )}
      {!error && data && data.reports.length > 0 && (
        <>
          <ul className="reports" data-testid="reports" aria-busy={loading}>
            {data.reports.map((r) => (
              <li key={r._id} className="card report">
                <div className="report-head">
                  <div className="grow">
                    {r.project ? (
                      <Link to={`/projects/${r.project._id}`} className="report-title">{r.project.title}</Link>
                    ) : (
                      <span className="report-title">Progetto eliminato</span>
                    )}
                    {r.project && <ProjectStatusBadge status={r.project.status} />}
                    {r.project?.owner?.name && <small className="muted"> · di {r.project.owner.name}</small>}
                  </div>
                  <span className={`pill report-pill-${r.status}`}>{REPORT_STATUS[r.status]}</span>
                </div>
                <blockquote className="report-reason">{r.reason}</blockquote>
                <p className="muted report-meta">
                  Segnalato da <strong>{r.reporter?.name}</strong> ({r.reporter?.email}) · {timeAgo(r.createdAt)}
                </p>
                {r.status !== 'open' && (
                  <p className="muted report-meta">
                    {r.status === 'actioned' ? 'Gestita' : 'Archiviata'} da {r.resolvedBy?.name || 'un amministratore'} il {formatDate(r.resolvedAt)}
                    {r.adminNote && <> · Nota: “{r.adminNote}”</>}
                  </p>
                )}
                {r.project && (
                  <div className="report-actions">
                    {r.status === 'open' ? (
                      <>
                        {r.project.status !== 'hidden' && (
                          <button className="btn btn-dark btn-sm" onClick={() => hide(r)}>
                            <Icon name="eye-off" size={14} /> Oscura il progetto
                          </button>
                        )}
                        <button className="btn btn-sm" onClick={() => setDismissing(r)}>Archivia senza azioni</button>
                      </>
                    ) : (
                      <button className="btn btn-sm" onClick={() => reopen(r)}>Riapri</button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}
      {dismissing && <DismissModal report={dismissing} onClose={() => setDismissing(null)} onDone={refresh} />}
    </div>
  );
}

function ProjectsPanel({ onChanged }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState('all');
  const [text, setText] = useState('');
  const q = useDebouncedValue(text, 300);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [q, status]);
  const { data, loading, error, reload } = useAsync(() => api.get(`/admin/projects${toQuery({ status, q, page })}`), [status, q, page]);

  const toggleHidden = async (p) => {
    const hide = p.status !== 'hidden';
    const ok = await confirm({
      title: hide ? `Oscurare "${p.title}"?` : `Rendere visibile "${p.title}"?`,
      message: hide ? 'Esce dal catalogo e i membri (tranne il proprietario) perdono l\'accesso.' : 'Torna attivo e i membri riottengono l\'accesso.',
      confirmLabel: hide ? 'Oscura' : 'Rendi visibile',
      danger: hide,
    });
    if (!ok) return;
    try {
      await api.patch(`/admin/projects/${p._id}/hide`, { hidden: hide });
      toast(hide ? 'Progetto oscurato' : 'Progetto di nuovo visibile', 'success');
      reload({ silent: true });
      onChanged();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <div>
      <div className="toolbar">
        <div className="search toolbar-search">
          <Icon name="search" size={18} />
          <input type="search" aria-label="Cerca un progetto per titolo" placeholder="Cerca per titolo" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <select aria-label="Filtra per stato" value={status} onChange={(e) => setStatus(e.target.value)} className="toolbar-select">
          <option value="all">Tutti gli stati</option>
          <option value="active">Attivi</option>
          <option value="archived">Archiviati</option>
          <option value="hidden">Oscurati</option>
        </select>
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      {!error && !data && loading && <RowsSkeleton rows={5} />}
      {!error && data && data.projects.length === 0 && <EmptyState icon="folder" title="Nessun progetto trovato" text="Cambia i filtri di ricerca." />}
      {!error && data && data.projects.length > 0 && (
        <>
          <div className="card table-wrap">
            <table className="table" data-testid="admin-projects">
              <thead>
                <tr><th>Progetto</th><th>Proprietario</th><th>Stato</th><th>Segnalazioni aperte</th><th>Creato</th><th><span className="visually-hidden">Azioni</span></th></tr>
              </thead>
              <tbody>
                {data.projects.map((p) => (
                  <tr key={p._id}>
                    <td><Link to={`/projects/${p._id}`}><strong>{p.title}</strong></Link><br /><small className="muted">{p.category} · {p.visibility === 'public' ? 'Pubblico' : 'Privato'}</small></td>
                    <td>{p.owner?.name}<br /><small className="muted">{p.owner?.email}</small></td>
                    <td>{p.status === 'active' ? <span className="pill pill-done">Attivo</span> : <ProjectStatusBadge status={p.status} />}</td>
                    <td className="tabular">{p.openReports}</td>
                    <td>{formatDate(p.createdAt)}</td>
                    <td className="right">
                      <button className="btn btn-sm" onClick={() => toggleHidden(p)}>
                        {p.status === 'hidden' ? 'Rendi visibile' : 'Oscura'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}

function UsersPanel({ onChanged }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState('all');
  const [text, setText] = useState('');
  const q = useDebouncedValue(text, 300);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [q, status]);
  const { data, loading, error, reload } = useAsync(() => api.get(`/admin/users${toQuery({ status, q, page })}`), [status, q, page]);

  const toggleBlocked = async (u) => {
    if (!u.blocked) {
      const ok = await confirm({
        title: `Bloccare ${u.name}?`,
        message: 'L\'utente non potrà più accedere e le sue sessioni aperte verranno chiuse subito, comprese le connessioni live. Potrai sbloccarlo in seguito.',
        confirmLabel: 'Blocca utente',
        danger: true,
      });
      if (!ok) return;
    }
    try {
      await api.patch(`/admin/users/${u._id}/block`, { blocked: !u.blocked });
      toast(u.blocked ? `${u.name} sbloccato` : `${u.name} bloccato`, 'success');
      reload({ silent: true });
      onChanged();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <div>
      <div className="toolbar">
        <div className="search toolbar-search">
          <Icon name="search" size={18} />
          <input type="search" aria-label="Cerca un utente" placeholder="Cerca per nome o email" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <select aria-label="Filtra per stato" value={status} onChange={(e) => setStatus(e.target.value)} className="toolbar-select">
          <option value="all">Tutti gli utenti</option>
          <option value="active">Attivi</option>
          <option value="blocked">Bloccati</option>
        </select>
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      {!error && !data && loading && <RowsSkeleton rows={5} />}
      {!error && data && data.users.length === 0 && <EmptyState icon="users" title="Nessun utente trovato" text="Cambia i filtri di ricerca." />}
      {!error && data && data.users.length > 0 && (
        <>
          <div className="card table-wrap">
            <table className="table" data-testid="admin-users">
              <thead>
                <tr><th>Utente</th><th>Ruolo</th><th>Stato</th><th>Iscritto</th><th><span className="visually-hidden">Azioni</span></th></tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u._id}>
                    <td><strong>{u.name}</strong><br /><small className="muted">{u.email}</small></td>
                    <td>{u.role === 'admin' ? 'Amministratore' : 'Utente'}</td>
                    <td>{u.blocked ? <span className="badge badge-project-hidden">Bloccato</span> : <span className="pill pill-done">Attivo</span>}</td>
                    <td>{formatDate(u.createdAt)}</td>
                    <td className="right">
                      {u.role !== 'admin' && (
                        <button className="btn btn-sm" onClick={() => toggleBlocked(u)}>{u.blocked ? 'Sblocca' : 'Blocca'}</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}

export default function Admin() {
  useDocumentTitle('Amministrazione');
  const { resyncKey } = useRealtime();
  const [params, setParams] = useSearchParams();
  const stats = useAsync(() => api.get('/admin/stats'), [resyncKey]);
  const reloadStats = stats.reload;
  const refreshStats = useCallback(() => reloadStats({ silent: true }), [reloadStats]);
  useSocketEvent('notification:new', useCallback((n) => n.type === 'project_reported' && reloadStats({ silent: true }), [reloadStats]));

  const s = stats.data;
  const tabs = [
    { id: 'reports', label: 'Segnalazioni', count: s?.openReports },
    { id: 'projects', label: 'Progetti', count: s?.projects },
    { id: 'users', label: 'Utenti', count: s?.users },
  ];
  const tab = tabs.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'reports';
  const setTab = (next) => setParams({ tab: next }, { replace: true });

  const cards = s && [
    { label: 'Segnalazioni da esaminare', value: s.openReports, tone: s.openReports ? 'warn' : '' },
    { label: 'Progetti oscurati', value: s.hiddenProjects },
    { label: 'Utenti bloccati', value: s.blockedUsers },
    { label: 'Utenti totali', value: s.users },
  ];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">Amministrazione</h1>
          <p className="page-lead">Modera i progetti segnalati e gestisci gli utenti della piattaforma.</p>
        </div>
      </header>

      {stats.error && <ErrorState message={stats.error} onRetry={stats.reload} />}
      {s && (
        <div className="stats">
          {cards.map((c) => (
            <div key={c.label} className={`card stat${c.tone ? ` stat-${c.tone}` : ''}`}>
              <strong className="stat-value">{c.value}</strong>
              <span>{c.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="admin-body">
        <Tabs tabs={tabs} value={tab} onChange={setTab} label="Sezioni amministrative" idPrefix="ad" />
        <div role="tabpanel" id={`ad-panel-${tab}`} aria-labelledby={`ad-${tab}`} className="tab-panel">
          {tab === 'reports' && <ReportsPanel onChanged={refreshStats} />}
          {tab === 'projects' && <ProjectsPanel onChanged={refreshStats} />}
          {tab === 'users' && <UsersPanel onChanged={refreshStats} />}
        </div>
      </div>
    </div>
  );
}
