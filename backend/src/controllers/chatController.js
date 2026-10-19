const Message = require('../models/Message');
const { emitToProject } = require('../sockets/emit');
const { requiredText } = require('../utils/validate');

// Ultimi 100 messaggi, dal più vecchio al più recente.
async function listMessages(req, res) {
  const messages = await Message.find({ project: req.project.id })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('author', 'name');
  res.json({ messages: messages.reverse() });
}

async function sendMessage(req, res) {
  const text = requiredText(req.body.text, 'Il messaggio', 2000);
  const message = await Message.create({ project: req.project.id, author: req.user.id, text });
  await message.populate('author', 'name');

  emitToProject(req.project.id, 'chat:message', message);
  res.status(201).json({ message });
}

module.exports = { listMessages, sendMessage };
