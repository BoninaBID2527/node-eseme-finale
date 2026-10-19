import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import { CATEGORIES } from '../utils';

// Pagina unica per creare (/projects/new) e modificare (/projects/:id/edit) un progetto.
export default function ProjectForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ title: '', description: '', category: 'Web', technologies: '', visibility: 'public' });
  const [cover, setCover] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(editing);

  useEffect(() => {
    if (!editing) return;
    api
      .get(`/projects/${id}`)
      .then(({ project, isOwner }) => {
        if (!isOwner) return navigate(`/projects/${id}`, { replace: true });
        setForm({
          title: project.title,
          description: project.description,
          category: project.category,
          technologies: project.technologies.join(', '),
          visibility: project.visibility,
        });
        setPreview(project.coverImage);
        setLoading(false);
      })
      .catch((err) => {
        toast(err.message, 'error');
        navigate('/dashboard');
      });
  }, [id, editing, navigate, toast]);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const pickCover = (e) => {
    const file = e.target.files[0];
    setCover(file || null);
    if (file) setPreview(URL.createObjectURL(file));
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, value));
    if (cover) body.append('cover', cover);
    try {
      const data = editing ? await api.put(`/projects/${id}`, body) : await api.post('/projects', body);
      toast(editing ? 'Progetto aggiornato' : 'Progetto creato', 'success');
      navigate(`/projects/${data.project._id}`);
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  };

  if (loading) return <div className="page muted">Caricamento…</div>;

  return (
    <div className="page page-narrow">
      <header className="page-head">
        <h1>{editing ? 'Modifica progetto' : 'Nuovo progetto'}</h1>
      </header>

      <form className="card form form-card" onSubmit={submit}>
        <label>
          Titolo
          <input value={form.title} onChange={update('title')} required maxLength={100} autoFocus />
        </label>
        <label>
          Descrizione
          <textarea rows={4} value={form.description} onChange={update('description')} />
        </label>
        <div className="form-row">
          <label>
            Categoria
            <input list="categories" value={form.category} onChange={update('category')} />
            <datalist id="categories">
              {CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label>
            Visibilità
            <select value={form.visibility} onChange={update('visibility')}>
              <option value="public">Pubblico (nel catalogo)</option>
              <option value="private">Privato (solo membri)</option>
            </select>
          </label>
        </div>
        <label>
          Tecnologie <small className="muted">separate da virgola</small>
          <input value={form.technologies} onChange={update('technologies')} placeholder="React, Node.js, MongoDB" />
        </label>
        <label>
          Immagine di copertina <small className="muted">max 2 MB</small>
          <input type="file" accept="image/*" onChange={pickCover} />
        </label>
        {preview && <div className="cover-preview" style={{ backgroundImage: `url(${preview})` }} />}

        <div className="modal-actions">
          <span className="spacer" />
          <button type="button" className="btn" onClick={() => navigate(-1)}>
            Annulla
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {editing ? 'Salva modifiche' : 'Crea progetto'}
          </button>
        </div>
      </form>
    </div>
  );
}
