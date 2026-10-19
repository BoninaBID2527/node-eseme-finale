const AppError = require('../utils/AppError');
const { isId } = require('../utils/validate');

// Da usare con router.param: un identificativo malformato dà 400, uno ben formato ma inesistente darà 404.
function validateId(req, res, next, value) {
  if (!isId(value)) throw new AppError(400, 'Identificativo non valido');
  next();
}

module.exports = validateId;
