const multer = require('multer');

function notFound(req, res) {
  res.status(404).json({ message: `Rotta non trovata: ${req.method} ${req.originalUrl}` });
}

// Ultimo middleware: trasforma ogni errore in una risposta JSON coerente { message, errors? }.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.status) {
    const body = { message: err.message };
    if (err.fields) body.errors = err.fields;
    return res.status(err.status).json(body);
  }

  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'La copertina può pesare al massimo 2 MB' : err.message;
    return res.status(400).json({ message, errors: { cover: message } });
  }
  if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
  if (err.name === 'CastError') return res.status(400).json({ message: 'Identificativo non valido' });
  if (err.code === 11000) return res.status(409).json({ message: 'Valore già esistente' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'JSON non valido' });
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Richiesta troppo grande' });

  console.error(err);
  res.status(500).json({ message: 'Errore interno del server' });
}

module.exports = { notFound, errorHandler };
