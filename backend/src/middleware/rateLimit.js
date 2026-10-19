const AppError = require('../utils/AppError');

// Limitatore in memoria: max `max` richieste ogni `windowMs` per chiave (es. IP + email).
// Basta per un'app singola; con più server servirebbe un archivio condiviso (es. Redis).
function rateLimit({ windowMs, max, key }) {
  const hits = new Map();

  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test') return next();

    const id = key(req);
    const now = Date.now();
    const entry = hits.get(id);

    if (!entry || entry.reset < now) {
      hits.set(id, { count: 1, reset: now + windowMs });
    } else if (++entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.reset - now) / 1000));
      throw new AppError(429, 'Troppi tentativi, riprova tra qualche minuto');
    }

    // Pulizia occasionale per non far crescere la mappa.
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    next();
  };
}

module.exports = rateLimit;
