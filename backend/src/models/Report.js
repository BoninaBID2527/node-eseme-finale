const mongoose = require('mongoose');

// open = da esaminare · dismissed = archiviata senza azioni · actioned = il progetto è stato oscurato
const reportSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: ['open', 'dismissed', 'actioned'], default: 'open', index: true },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
    adminNote: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Report', reportSchema);
