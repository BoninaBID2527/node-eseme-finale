// Errore con codice HTTP: lo intercetta errorHandler e risponde al client.
class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = AppError;
