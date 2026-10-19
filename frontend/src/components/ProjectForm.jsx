import { useRef, useState } from 'react';
import Field from './Field';
import Icon from './Icon';
import ProjectCover from './ProjectCover';
import { errorMessage } from '../utils';

const CATEGORIES = ['Web', 'Mobile', 'Dati', 'Design', 'Documentazione', 'Altro'];
const MAX_COVER = 2 * 1024 * 1024;
const COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Form di creazione e modifica di un progetto (pagina "Nuovo progetto" e scheda "Impostazioni").
// onSubmit riceve un FormData (serve per caricare la copertina) e può lanciare errori con `fields`.
export default function ProjectForm({ project, onSubmit, submitLabel, disabled = false, onCancel }) {
  const [form, setForm] = useState({
    title: project?.title ?? '',
    description: project?.description ?? '',
    category: project?.category ?? 'Web',
    technologies: project?.technologies?.join(', ') ?? '',
    visibility: project?.visibility ?? 'public',
  });
  const [cover, setCover] = useState(null);
  const [preview, setPreview] = useState(project?.coverImage ?? '');
  const [removeCover, setRemoveCover] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const update = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
    if (errors[field]) setErrors({ ...errors, [field]: undefined });
  };

  const pickCover = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!COVER_TYPES.includes(file.type)) return setErrors({ ...errors, cover: 'Usa un\'immagine JPG, PNG, WebP o GIF' });
    if (file.size > MAX_COVER) return setErrors({ ...errors, cover: 'La copertina può pesare al massimo 2 MB' });
    setErrors({ ...errors, cover: undefined });
    setCover(file);
    setRemoveCover(false);
    setPreview(URL.createObjectURL(file));
  };

  const clearCover = () => {
    setCover(null);
    setPreview('');
    setRemoveCover(true);
    if (fileRef.current) fileRef.current.value = '';
  };

  const technologies = form.technologies.split(',').map((t) => t.trim()).filter(Boolean);

  const submit = async (e) => {
    e.preventDefault();
    setErrors({});
    setFormError('');
    setBusy(true);
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, value));
    if (cover) body.append('cover', cover);
    if (removeCover && !cover) body.append('removeCover', 'true');
    try {
      await onSubmit(body);
    } catch (err) {
      if (err.fields) setErrors(err.fields);
      else setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <fieldset className="form" disabled={disabled}>
        <Field label="Titolo" error={errors.title}>
          <input value={form.title} onChange={update('title')} maxLength={100} required autoFocus={!project} />
        </Field>
        <Field label="Descrizione" error={errors.description} optional hint="Spiega di cosa si tratta e cosa cerchi nel team.">
          <textarea rows={4} value={form.description} onChange={update('description')} maxLength={2000} />
        </Field>
        <div className="form-row">
          <Field label="Categoria" error={errors.category}>
            <input list="project-categories" value={form.category} onChange={update('category')} maxLength={40} />
          </Field>
          <Field label="Tecnologie" error={errors.technologies} optional hint="Separate da virgola">
            <input value={form.technologies} onChange={update('technologies')} placeholder="React, Node.js, MongoDB" />
          </Field>
        </div>
        <datalist id="project-categories">
          {CATEGORIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        {technologies.length > 0 && (
          <ul className="chips" aria-label="Anteprima delle tecnologie">
            {technologies.map((t) => (
              <li key={t} className="chip">{t}</li>
            ))}
          </ul>
        )}

        <fieldset className="choice-group">
          <legend>Visibilità</legend>
          <label className={`choice${form.visibility === 'public' ? ' is-selected' : ''}`}>
            <input type="radio" name="visibility" value="public" checked={form.visibility === 'public'} onChange={update('visibility')} />
            <Icon name="globe" size={20} />
            <span>
              <strong>Pubblico</strong>
              <small>Compare nel catalogo. Bacheca e chat restano riservate ai membri.</small>
            </span>
          </label>
          <label className={`choice${form.visibility === 'private' ? ' is-selected' : ''}`}>
            <input type="radio" name="visibility" value="private" checked={form.visibility === 'private'} onChange={update('visibility')} />
            <Icon name="lock" size={20} />
            <span>
              <strong>Privato</strong>
              <small>Visibile solo a te e ai membri che inviti.</small>
            </span>
          </label>
          {errors.visibility && <p className="field-error">{errors.visibility}</p>}
        </fieldset>

        <div className="field">
          <label htmlFor="cover-input">
            Immagine di copertina <span className="field-optional">(facoltativa, max 2 MB)</span>
          </label>
          <div className="cover-picker">
            <div className="cover-picker-preview">
              {preview ? <img src={preview} alt="Anteprima della copertina" /> : <ProjectCover project={{ _id: project?._id || form.title || 'nuovo', title: form.title }} />}
            </div>
            <div className="cover-picker-actions">
              <input id="cover-input" ref={fileRef} type="file" accept={COVER_TYPES.join(',')} onChange={pickCover} aria-describedby="cover-help" aria-invalid={errors.cover ? true : undefined} className="visually-hidden-input" />
              <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()}>
                <Icon name="upload" size={16} /> {preview ? 'Cambia immagine' : 'Carica immagine'}
              </button>
              {preview && (
                <button type="button" className="btn btn-sm btn-danger-ghost" onClick={clearCover}>
                  Rimuovi
                </button>
              )}
              <p id="cover-help" className="field-hint">
                {preview ? '' : 'Senza immagine verrà usata una copertina generata dal progetto.'}
              </p>
            </div>
          </div>
          {errors.cover && <p className="field-error">{errors.cover}</p>}
        </div>
      </fieldset>

      {formError && (
        <p className="form-alert" role="alert">
          {formError}
        </p>
      )}
      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Annulla
          </button>
        )}
        <button className="btn btn-primary" disabled={busy || disabled}>
          {busy ? 'Salvataggio…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
