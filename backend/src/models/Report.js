const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Report', reportSchema);
