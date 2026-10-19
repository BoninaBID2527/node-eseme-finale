// Errore con codice HTTP: lo intercetta errorHandler e risponde al client.
// `fields` (opzionale) associa un messaggio ad ogni campo del form non valido;
// `code` (opzionale) è un identificativo stabile che il frontend può riconoscere (es. sessione scaduta).
class AppError extends Error {
  constructor(status, message, fields, code) {
    super(message);
    this.status = status;
    this.fields = fields;
    this.code = code;
  }
}

module.exports = AppError;
