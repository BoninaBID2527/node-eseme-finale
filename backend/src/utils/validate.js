const AppError = require('./AppError');

// Testo obbligatorio: errore 400 se manca o è vuoto.
function requiredText(value, label, max = 200) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new AppError(400, `${label} è obbligatorio`);
  if (text.length > max) throw new AppError(400, `${label} è troppo lungo (max ${max} caratteri)`);
  return text;
}

// Accetta un array oppure una stringa separata da virgole (come arriva da un form multipart).
function parseList(value) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : String(value).split(',');
  return list.map((v) => String(v).trim()).filter(Boolean);
}

function oneOf(value, allowed, label) {
  if (!allowed.includes(value)) throw new AppError(400, `${label} non valido (valori ammessi: ${allowed.join(', ')})`);
  return value;
}

function parseDate(value, label) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new AppError(400, `${label} non è una data valida`);
  return date;
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { requiredText, parseList, oneOf, parseDate, escapeRegex };
