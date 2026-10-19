// Errore con codice HTTP: lo intercetta errorHandler e risponde al client.
// `fields` (opzionale) associa un messaggio ad ogni campo del form non valido.
class AppError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

module.exports = AppError;
