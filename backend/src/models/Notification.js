const mongoose = require('mongoose');

const TYPES = [
  'task_assigned',
  'task_moved',
  'member_joined',
  'member_removed',
  'member_left',
  'project_invitation',
  'invitation_declined',
  'project_reported',
  'project_hidden',
];

// Le notifiche puntano alla risorsa pertinente (progetto, task, invito) così il frontend può aprirla.
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: TYPES, required: true },
    text: { type: String, required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    invitation: { type: mongoose.Schema.Types.ObjectId, ref: 'Invitation' },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
