// Dati di esempio: ATTENZIONE, svuota il database indicato in MONGO_URI.
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { mongoUri } = require('../src/config/env');
const User = require('../src/models/User');
const Project = require('../src/models/Project');
const Task = require('../src/models/Task');
const Message = require('../src/models/Message');

const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

async function seed() {
  await mongoose.connect(mongoUri);
  await mongoose.connection.dropDatabase();
  await mongoose.syncIndexes(); // dopo il drop gli indici (es. email unica) vanno ricreati

  const passwordHash = await bcrypt.hash('password123', 10);
  const adminHash = await bcrypt.hash('admin1234', 10);

  const [admin, giulia, marco, sara] = await User.create([
    { name: 'Admin', email: 'admin@taskflow.test', passwordHash: adminHash, role: 'admin' },
    { name: 'Giulia Rossi', email: 'giulia@taskflow.test', passwordHash },
    { name: 'Marco Bianchi', email: 'marco@taskflow.test', passwordHash },
    { name: 'Sara Verdi', email: 'sara@taskflow.test', passwordHash },
  ]);

  const [website, app, secret, docs] = await Project.create([
    {
      title: 'Sito vetrina del negozio',
      description: 'Rifacimento del sito di un negozio locale con catalogo e contatti.',
      category: 'Web',
      technologies: ['React', 'Node.js', 'CSS'],
      visibility: 'public',
      owner: giulia.id,
      members: [marco.id, sara.id],
    },
    {
      title: 'App per allenamenti',
      description: 'App mobile per tenere traccia degli allenamenti settimanali.',
      category: 'Mobile',
      technologies: ['Flutter', 'Firebase'],
      visibility: 'public',
      owner: marco.id,
      members: [giulia.id],
    },
    {
      title: 'Progetto riservato',
      description: 'Visibile solo ai membri.',
      category: 'Altro',
      technologies: ['Node.js'],
      visibility: 'private',
      owner: sara.id,
    },
    {
      title: 'Documentazione API',
      description: 'Scrittura della documentazione per una REST API.',
      category: 'Documentazione',
      technologies: ['Markdown', 'Postman'],
      visibility: 'public',
      owner: sara.id,
      members: [giulia.id],
    },
  ]);

  await Task.create([
    { project: website.id, title: 'Disegnare la home', priority: 'high', status: 'done', assignee: sara.id, dueDate: daysFromNow(-2), createdBy: giulia.id },
    { project: website.id, title: 'Pagina catalogo prodotti', description: 'Lista con filtri e ricerca.', priority: 'high', status: 'in_progress', assignee: marco.id, dueDate: daysFromNow(3), createdBy: giulia.id },
    { project: website.id, title: 'Form di contatto', priority: 'medium', status: 'todo', assignee: giulia.id, dueDate: daysFromNow(5), createdBy: giulia.id },
    { project: website.id, title: 'Ottimizzare le immagini', priority: 'low', status: 'todo', createdBy: giulia.id },
    { project: app.id, title: 'Schermata di login', priority: 'medium', status: 'in_progress', assignee: giulia.id, dueDate: daysFromNow(1), createdBy: marco.id },
    { project: app.id, title: 'Salvataggio allenamenti', priority: 'high', status: 'todo', assignee: marco.id, dueDate: daysFromNow(7), createdBy: marco.id },
    { project: docs.id, title: 'Descrivere gli endpoint di auth', priority: 'medium', status: 'todo', assignee: giulia.id, dueDate: daysFromNow(4), createdBy: sara.id },
  ]);

  await Message.create([
    { project: website.id, author: giulia.id, text: 'Ciao ragazzi, ho creato la bacheca: prendetevi un task ciascuno!' },
    { project: website.id, author: marco.id, text: 'Io parto dal catalogo prodotti.' },
    { project: website.id, author: sara.id, text: 'La home è pronta, l\'ho segnata come completata.' },
  ]);

  console.log('Database popolato.');
  console.log('Admin:  admin@taskflow.test / admin1234');
  console.log('Utenti: giulia@taskflow.test, marco@taskflow.test, sara@taskflow.test / password123');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed fallito:', err.message);
  process.exit(1);
});
