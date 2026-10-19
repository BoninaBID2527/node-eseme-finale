const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const AppError = require('../utils/AppError');

const uploadDir = path.join(__dirname, '..', '..', 'uploads');

// Solo formati raster: niente SVG, che potrebbe contenere script serviti dallo stesso dominio.
const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  // Il nome viene generato dal server: quello scelto dall'utente non viene mai usato.
  filename: (req, file, cb) => cb(null, crypto.randomUUID() + ALLOWED[file.mimetype]),
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED[file.mimetype]) return cb(new AppError(400, 'La copertina deve essere un\'immagine JPG, PNG, WebP o GIF', { cover: 'Formato non supportato (usa JPG, PNG, WebP o GIF)' }));
    cb(null, true);
  },
});

// Elimina un file caricato (usato se la richiesta fallisce dopo l'upload, o quando la copertina viene sostituita).
function deleteUpload(publicPath) {
  if (!publicPath || !publicPath.startsWith('/uploads/')) return;
  fs.unlink(path.join(uploadDir, path.basename(publicPath)), () => {});
}

module.exports = { uploadCover: upload.single('cover'), uploadDir, deleteUpload };
