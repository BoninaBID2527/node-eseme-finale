const mongoose = require('mongoose');
const AppError = require('./AppError');

// Raccoglie gli errori di validazione di più campi e li lancia insieme (400),
// così il frontend può mostrare ogni messaggio accanto al campo giusto.
class Validator {
  constructor() {
    this.errors = {};
  }

  fail(field, message) {
    if (!this.errors[field]) this.errors[field] = message;
  }

  // Testo; restituisce il valore ripulito ('' se facoltativo e vuoto).
  text(field, value, { label, required = false, min = 0, max = 200 } = {}) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) {
      if (required) this.fail(field, `${label} è obbligatorio`);
      return '';
    }
    if (text.length < min) this.fail(field, `${label} deve avere almeno ${min} caratteri`);
    if (text.length > max) this.fail(field, `${label} è troppo lungo (max ${max} caratteri)`);
    return text;
  }

  email(field, value, label = 'L\'email') {
    const email = this.text(field, value, { label, required: true, max: 120 }).toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) this.fail(field, 'Inserisci un\'email valida');
    return email;
  }

  oneOf(field, value, allowed, label) {
    if (!allowed.includes(value)) {
      this.fail(field, `${label} non valido (valori ammessi: ${allowed.join(', ')})`);
      return undefined;
    }
    return value;
  }

  date(field, value, label) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      this.fail(field, `${label} non è una data valida`);
      return undefined;
    }
    return date;
  }

  throwIfErrors() {
    const fields = Object.keys(this.errors);
    if (fields.length) throw new AppError(400, this.errors[fields[0]], this.errors);
  }
}

// Accetta un array oppure una stringa separata da virgole (come arriva da un form multipart).
function parseList(value, { max = 10, itemMax = 30 } = {}) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : String(value).split(',');
  const clean = list.map((v) => String(v).trim()).filter(Boolean);
  return [...new Set(clean)].slice(0, max).map((v) => v.slice(0, itemMax));
}

const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isId = (value) => mongoose.isValidObjectId(value) && String(value).length === 24;

module.exports = { Validator, parseList, escapeRegex, isId };
