const express = require('express');
const cors = require('cors');
const { clientUrl } = require('./config/env');
const { uploadDir } = require('./middleware/upload');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: clientUrl }));
app.use(express.json());
// Express 5 lascia req.body undefined se la richiesta non ha corpo: lo normalizziamo.
app.use((req, res, next) => {
  req.body ??= {};
  next();
});

app.use('/uploads', express.static(uploadDir));
app.use('/api', require('./routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
