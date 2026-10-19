const mongoose = require('mongoose');

// Commento su un task: serve a discutere di un singolo lavoro senza sporcare la chat del progetto.
const taskCommentSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

taskCommentSchema.index({ task: 1, _id: -1 });

module.exports = mongoose.model('TaskComment', taskCommentSchema);
