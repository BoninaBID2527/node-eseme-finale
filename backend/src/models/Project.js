const mongoose = require('mongoose');

// status: active = modificabile · archived = sola lettura (il proprietario può riattivarlo)
//         hidden = oscurato da un admin (visibile solo al proprietario, in sola lettura, e agli admin)
const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: { type: String, default: 'Altro', trim: true },
    technologies: [{ type: String, trim: true }],
    visibility: { type: String, enum: ['public', 'private'], default: 'private' },
    coverImage: { type: String, default: '' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
    status: { type: String, enum: ['active', 'archived', 'hidden'], default: 'active' },
  },
  { timestamps: true }
);

projectSchema.index({ visibility: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Project', projectSchema);
