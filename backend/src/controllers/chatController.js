const Message = require('../models/Message');
const { emitToProject } = require('../sockets/emit');
const { Validator, isId } = require('../utils/validate');
const AppError = require('../utils/AppError');

const PAGE_SIZE = 30;

// Cronologia a pagine con cursore: senza `before` restituisce gli ultimi messaggi,
// con `before=<id>` quelli precedenti. L'ordine dell'_id coincide con quello di invio.
async function listMessages(req, res) {
  const { before } = req.query;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || PAGE_SIZE, 1), 100);
  const filter = { project: req.project.id };
  if (before) {
    if (!isId(before)) throw new AppError(400, 'Cursore non valido');
    filter._id = { $lt: before };
  }

  const rows = await Message.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate('author', 'name');
  const hasMore = rows.length > limit;

  res.json({ messages: rows.slice(0, limit).reverse(), hasMore });
}

async function sendMessage(req, res) {
  const v = new Validator();
  const text = v.text('text', req.body.text, { label: 'Il messaggio', required: true, max: 2000 });
  v.throwIfErrors();

  const message = await Message.create({ project: req.project.id, author: req.user.id, text });
  await message.populate('author', 'name');

  emitToProject(req.project.id, 'chat:message', message);
  res.status(201).json({ message });
}

module.exports = { listMessages, sendMessage };
