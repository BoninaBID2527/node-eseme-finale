const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    blocked: { type: Boolean, default: false },
    // I token emessi prima di questa data non valgono più (cambio password).
    passwordChangedAt: { type: Date },
  },
  { timestamps: true }
);

// Non esporre mai l'hash della password nelle risposte JSON.
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.passwordChangedAt;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
