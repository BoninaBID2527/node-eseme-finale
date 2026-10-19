const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: { type: String, default: 'Altro', trim: true },
    technologies: [{ type: String, trim: true }],
    visibility: { type: String, enum: ['public', 'private'], default: 'private' },
    coverImage: { type: String, default: '' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    status: { type: String, enum: ['active', 'archived', 'hidden'], default: 'active' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Project', projectSchema);
