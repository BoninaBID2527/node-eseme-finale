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

// Il tipo MIME lo dichiara il client: si controllano anche i primi byte del file (la sua "firma" reale).
const SIGNATURES = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/gif': (b) => ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('latin1')),
  'image/webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
};

function verifyCover(req, res, next) {
  if (!req.file) return next();
  const head = Buffer.alloc(12);
  const fd = fs.openSync(req.file.path, 'r');
  fs.readSync(fd, head, 0, 12, 0);
  fs.closeSync(fd);

  if (!SIGNATURES[req.file.mimetype](head)) {
    fs.unlink(req.file.path, () => {});
    throw new AppError(400, 'Il file non è un\'immagine valida', { cover: 'Il file non è un\'immagine valida' });
  }
  next();
}

module.exports = { uploadCover: [upload.single('cover'), verifyCover], uploadDir, deleteUpload };
