import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import ProjectForm from '../components/ProjectForm';
import { useToast } from '../context/ToastContext';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function NewProject() {
  useDocumentTitle('Nuovo progetto');
  const navigate = useNavigate();
  const toast = useToast();

  const create = async (body) => {
    const data = await api.post('/projects', body);
    toast('Progetto creato', 'success');
    navigate(`/projects/${data.project._id}`);
  };

  return (
    <div className="page page-narrow">
      <header className="page-head">
        <div>
          <h1 className="page-title">Nuovo progetto</h1>
          <p className="page-lead">Dai un nome al progetto: potrai invitare i membri e creare i task subito dopo.</p>
        </div>
      </header>
      <div className="card panel">
        <ProjectForm onSubmit={create} submitLabel="Crea progetto" onCancel={() => navigate(-1)} />
      </div>
    </div>
  );
}
