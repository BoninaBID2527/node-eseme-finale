const express = require('express');
const cors = require('cors');
const { clientUrl } = require('./config/env');
const { uploadDir } = require('./middleware/upload');
const securityHeaders = require('./middleware/security');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');
app.use(securityHeaders);
app.use(cors({ origin: clientUrl }));
app.use(express.json({ limit: '100kb' }));
// Express 5 lascia req.body undefined se la richiesta non ha corpo: lo normalizziamo.
app.use((req, res, next) => {
  req.body ??= {};
  next();
});

// Le copertine sono pubbliche ma servite come semplici immagini (niente listing, niente sniffing del tipo).
app.use('/uploads', express.static(uploadDir, { index: false, maxAge: '1h' }));
app.use('/api', require('./routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
