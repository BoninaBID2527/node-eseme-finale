const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');

async function listNotifications(req, res) {
  const [notifications, unread] = await Promise.all([
    Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(50),
    Notification.countDocuments({ user: req.user.id, read: false }),
  ]);
  res.json({ notifications, unread });
}

async function markRead(req, res) {
  const { id } = req.params;
  const notification = mongoose.isValidObjectId(id)
    ? await Notification.findOneAndUpdate({ _id: id, user: req.user.id }, { read: true }, { returnDocument: 'after' })
    : null;
  if (!notification) throw new AppError(404, 'Notifica non trovata');
  res.json({ notification });
}

async function markAllRead(req, res) {
  await Notification.updateMany({ user: req.user.id, read: false }, { read: true });
  res.json({ message: 'Notifiche segnate come lette' });
}

module.exports = { listNotifications, markRead, markAllRead };
