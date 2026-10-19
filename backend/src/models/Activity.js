const mongoose = require('mongoose');

const TYPES = [
  'task_created',
  'task_moved',
  'task_assigned',
  'task_deleted',
  'comment_added',
  'member_joined',
  'member_removed',
  'member_left',
  'project_archived',
  'project_reactivated',
];

// Cronologia del progetto (registro delle attività). Il testo viene salvato già composto
// ("Giulia ha spostato "X" in In corso"): resta leggibile anche se il task viene poi rinominato o eliminato.
const activitySchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: TYPES, required: true },
    text: { type: String, required: true },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
  },
  { timestamps: true }
);

activitySchema.index({ project: 1, _id: -1 });

module.exports = mongoose.model('Activity', activitySchema);
