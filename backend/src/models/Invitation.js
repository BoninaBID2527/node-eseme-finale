const mongoose = require('mongoose');

// Invito a un progetto: il destinatario può accettare o rifiutare, il proprietario può annullarlo.
const invitationSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    invitee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    inviter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted', 'declined', 'cancelled'], default: 'pending' },
    respondedAt: { type: Date },
  },
  { timestamps: true }
);

// Un solo invito in attesa per coppia progetto/utente (lo garantisce il database).
invitationSchema.index({ project: 1, invitee: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });

module.exports = mongoose.model('Invitation', invitationSchema);
