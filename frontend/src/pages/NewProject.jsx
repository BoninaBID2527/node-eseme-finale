import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import PageHeader from '../components/PageHeader';
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
      <PageHeader
        eyebrow="Progetti"
        title="Nuovo progetto"
        lead="Dai un nome al progetto: potrai invitare i membri e creare i task subito dopo."
      />
      <div className="card panel new-project">
        <ProjectForm onSubmit={create} submitLabel="Crea progetto" onCancel={() => navigate(-1)} />
      </div>
    </div>
  );
}
