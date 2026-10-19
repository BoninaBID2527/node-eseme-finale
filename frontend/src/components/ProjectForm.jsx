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

  const [dragging, setDragging] = useState(false);

  const setCoverFile = (file) => {
    if (!file) return;
    if (!COVER_TYPES.includes(file.type)) return setErrors({ ...errors, cover: 'Usa un\'immagine JPG, PNG, WebP o GIF' });
    if (file.size > MAX_COVER) return setErrors({ ...errors, cover: 'La copertina può pesare al massimo 2 MB' });
    setErrors({ ...errors, cover: undefined });
    setCover(file);
    setRemoveCover(false);
    setPreview(URL.createObjectURL(file));
  };

  const pickCover = (e) => setCoverFile(e.target.files[0]);

  const dropCover = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && fileRef.current) {
      // Il file trascinato viene collegato anche al campo vero, così resta coerente con la selezione da tastiera.
      const transfer = new DataTransfer();
      transfer.items.add(file);
      fileRef.current.files = transfer.files;
    }
    setCoverFile(file);
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

  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <form className="form-sections" onSubmit={submit} noValidate>
      <fieldset className="form-sections" disabled={disabled}>
        <section className="form-section" aria-labelledby="pf-info">
          <div className="form-section-head">
            <h3 id="pf-info"><span aria-hidden="true">1</span> Informazioni</h3>
            <p>Titolo e descrizione sono ciò che le persone leggono per prime.</p>
          </div>
          <Field label="Titolo" error={errors.title} counter={`${form.title.length}/100`}>
            <input value={form.title} onChange={update('title')} maxLength={100} required autoFocus={!project} placeholder="Es. Gestionale per la palestra" />
          </Field>
          <Field label="Descrizione" error={errors.description} optional counter={`${form.description.length}/2000`} hint="Spiega di cosa si tratta e cosa cerchi nel team.">
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
        </section>

        <section className="form-section" aria-labelledby="pf-vis">
          <div className="form-section-head">
            <h3 id="pf-vis"><span aria-hidden="true">2</span> Visibilità</h3>
            <p>Puoi cambiarla in qualsiasi momento dalle impostazioni.</p>
          </div>
          <fieldset className="choice-group">
            <legend className="visually-hidden">Visibilità</legend>
            <label className={`choice${form.visibility === 'public' ? ' is-selected' : ''}`}>
              <input type="radio" name="visibility" value="public" checked={form.visibility === 'public'} onChange={update('visibility')} />
              <Icon name="globe" size={20} />
              <span>
                <strong>Pubblico</strong>
                <small>Compare nel catalogo. Bacheca e chat restano riservate ai membri.</small>
              </span>
              <span className="choice-mark" aria-hidden="true"><Icon name="check" size={14} /></span>
            </label>
            <label className={`choice${form.visibility === 'private' ? ' is-selected' : ''}`}>
              <input type="radio" name="visibility" value="private" checked={form.visibility === 'private'} onChange={update('visibility')} />
              <Icon name="lock" size={20} />
              <span>
                <strong>Privato</strong>
                <small>Visibile solo a te e ai membri che inviti.</small>
              </span>
              <span className="choice-mark" aria-hidden="true"><Icon name="check" size={14} /></span>
            </label>
            {errors.visibility && <p className="field-error"><Icon name="alert" size={15} /><span>{errors.visibility}</span></p>}
          </fieldset>
        </section>

        <section className="form-section" aria-labelledby="pf-cover">
          <div className="form-section-head">
            <h3 id="pf-cover"><span aria-hidden="true">3</span> Copertina</h3>
            <p>Facoltativa, JPG, PNG, WebP o GIF fino a 2 MB.</p>
          </div>
          <div className="field">
            <label htmlFor="cover-input" className="visually-hidden">Immagine di copertina (facoltativa, max 2 MB)</label>
            <div className="cover-picker">
              <div className="cover-picker-preview">
                {preview ? <img src={preview} alt="Anteprima della copertina" /> : <ProjectCover project={{ _id: project?._id || form.title || 'nuovo', title: form.title, category: form.category }} />}
              </div>
              <div>
                <input id="cover-input" ref={fileRef} type="file" accept={COVER_TYPES.join(',')} onChange={pickCover} aria-describedby="cover-help" aria-invalid={errors.cover ? true : undefined} className="visually-hidden-input" />
                <label
                  htmlFor="cover-input"
                  className={`dropzone${dragging ? ' is-over' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={dropCover}
                >
                  <Icon name="upload" size={20} />
                  <strong>{preview ? 'Cambia immagine' : 'Carica un\'immagine'}</strong>
                  <small id="cover-help">Trascina qui un file o fai clic per sceglierlo.{preview ? '' : ' Senza immagine userai una copertina generata.'}</small>
                  {cover && <small>{cover.name} · {(cover.size / 1024).toFixed(0)} KB</small>}
                </label>
                {preview && (
                  <div className="dropzone-file">
                    <button type="button" className="btn btn-sm btn-danger-ghost" onClick={clearCover}>
                      <Icon name="trash" size={14} /> Rimuovi copertina
                    </button>
                  </div>
                )}
              </div>
            </div>
            {errors.cover && <p className="field-error"><Icon name="alert" size={15} /><span>{errors.cover}</span></p>}
          </div>
        </section>
      </fieldset>

      <div className="form-footer">
        {errorCount > 0 && (
          <p className="form-alert" role="alert">
            {errorCount === 1 ? 'Un campo non è corretto: controlla il messaggio indicato.' : `${errorCount} campi non sono corretti: controlla i messaggi indicati.`}
          </p>
        )}
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
          <button className={`btn btn-primary${busy ? ' is-loading' : ''}`} disabled={busy || disabled} aria-busy={busy}>
            <span>{submitLabel}</span>
          </button>
        </div>
      </div>
    </form>
  );
}
