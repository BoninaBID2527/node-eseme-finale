const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');
const { getPage, pageInfo } = require('../utils/pagination');

async function listNotifications(req, res) {
  const filter = { user: req.user.id };
  if (req.query.unread === 'true') filter.read = false;

  const paging = getPage(req.query, { defaultLimit: 20, maxLimit: 50 });
  const [total, notifications, unread] = await Promise.all([
    Notification.countDocuments(filter),
    Notification.find(filter).sort({ createdAt: -1 }).skip(paging.skip).limit(paging.limit),
    Notification.countDocuments({ user: req.user.id, read: false }),
  ]);
  res.json({ notifications, unread, ...pageInfo(total, paging) });
}

// Conteggio leggero per il badge nella barra laterale.
async function unreadCount(req, res) {
  res.json({ unread: await Notification.countDocuments({ user: req.user.id, read: false }) });
}

async function markRead(req, res) {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    { read: true },
    { returnDocument: 'after' }
  );
  if (!notification) throw new AppError(404, 'Notifica non trovata');
  res.json({ notification });
}

async function markAllRead(req, res) {
  await Notification.updateMany({ user: req.user.id, read: false }, { read: true });
  res.json({ message: 'Notifiche segnate come lette' });
}

module.exports = { listNotifications, unreadCount, markRead, markAllRead };
