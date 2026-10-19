const Report = require('../models/Report');

// Migrazioni idempotenti: sistemano i dati creati dalle versioni precedenti senza cancellare nulla.
async function migrate() {
  // Le segnalazioni vecchie non avevano uno stato: sono da esaminare.
  await Report.updateMany({ status: { $exists: false } }, { $set: { status: 'open' } });
}

module.exports = migrate;
