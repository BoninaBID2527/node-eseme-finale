import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useSocketEvent } from '../context/RealtimeContext';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../utils';

export default function Admin() {
  const toast = useToast();
  const [tab, setTab] = useState('reports');
  const [reports, setReports] = useState(null);
  const [users, setUsers] = useState(null);

  const loadReports = useCallback(() => api.get('/admin/reports').then((d) => setReports(d.reports)).catch((e) => toast(e.message, 'error')), [toast]);
  const loadUsers = useCallback(() => api.get('/admin/users').then((d) => setUsers(d.users)).catch((e) => toast(e.message, 'error')), [toast]);

  useEffect(() => {
    loadReports();
    loadUsers();
  }, [loadReports, loadUsers]);

  // Una nuova segnalazione compare subito nella lista.
  useSocketEvent('notification:new', useCallback((n) => n.type === 'project_reported' && loadReports(), [loadReports]));

  const toggleHidden = async (report) => {
    const hide = report.project.status !== 'hidden';
    try {
      await api.patch(`/admin/projects/${report.project._id}/hide`, { hidden: hide });
      toast(hide ? 'Progetto nascosto dal catalogo' : 'Progetto di nuovo visibile', 'success');
      loadReports();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const toggleBlocked = async (u) => {
    try {
      await api.patch(`/admin/users/${u._id}/block`, { blocked: !u.blocked });
      toast(u.blocked ? `${u.name} sbloccato` : `${u.name} bloccato`, 'success');
      loadUsers();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Pannello amministratore</h1>
          <p className="muted">Modera i progetti segnalati e gestisci gli utenti.</p>
        </div>
      </header>

      <div className="tabs tabs-page" role="tablist">
        <button role="tab" className={tab === 'reports' ? 'active' : ''} onClick={() => setTab('reports')}>
          Segnalazioni {reports ? `(${reports.length})` : ''}
        </button>
        <button role="tab" className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>
          Utenti {users ? `(${users.length})` : ''}
        </button>
      </div>

      {tab === 'reports' &&
        (reports?.length === 0 ? (
          <div className="empty card">
            <h3>Nessuna segnalazione</h3>
            <p className="muted">Quando un utente segnala un progetto lo vedrai qui in tempo reale.</p>
          </div>
        ) : (
          <div className="card list" data-testid="reports">
            {reports?.map((r) => (
              <div key={r._id} className="list-row">
                <div className="grow">
                  <Link to={`/projects/${r.project._id}`}>
                    <strong>{r.project.title}</strong>
                  </Link>
                  {r.project.status === 'hidden' && <span className="badge badge-status">Nascosto</span>}
                  <p className="report-reason">“{r.reason}”</p>
                  <small className="muted">
                    Segnalato da {r.reporter.name} · {formatDate(r.createdAt)}
                  </small>
                </div>
                <button className="btn" onClick={() => toggleHidden(r)}>
                  {r.project.status === 'hidden' ? 'Rendi visibile' : 'Nascondi progetto'}
                </button>
              </div>
            ))}
          </div>
        ))}

      {tab === 'users' && (
        <div className="card table-wrap">
          <table className="table" data-testid="users">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Ruolo</th>
                <th>Stato</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u._id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role === 'admin' ? 'Admin' : 'Utente'}</td>
                  <td>{u.blocked ? <span className="badge badge-high">Bloccato</span> : <span className="badge badge-low">Attivo</span>}</td>
                  <td className="right">
                    {u.role !== 'admin' && (
                      <button className="btn" onClick={() => toggleBlocked(u)}>
                        {u.blocked ? 'Sblocca' : 'Blocca'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
