const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const { env } = require('./env');

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

function ensureTmpDir() {
  if (!fs.existsSync(env.paginasImagensTmpDir)) {
    fs.mkdirSync(env.paginasImagensTmpDir, { recursive: true });
  }
}

ensureTmpDir();

function getExtension(originalname) {
  const ext = path.extname(originalname || '').toLowerCase();
  return ext || '.bin';
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    ensureTmpDir();
    cb(null, env.paginasImagensTmpDir);
  },
  filename(_req, file, cb) {
    const ext = getExtension(file.originalname);
    if (!IMAGE_EXTS.has(ext)) {
      return cb(new Error('Tipo de imagem não permitido. Use JPG, PNG, WebP ou GIF.'));
    }
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const ext = getExtension(file.originalname);
  if (!IMAGE_MIMES.has(file.mimetype) || !IMAGE_EXTS.has(ext)) {
    return cb(new Error('Tipo de imagem não permitido. Use JPG, PNG, WebP ou GIF (sem SVG).'));
  }
  return cb(null, true);
}

const uploadPaginaImagem = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.paginasImagensUploadMaxMb * 1024 * 1024, files: 1 },
});

function handlePaginasMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        mensagem: `Arquivo excede ${env.paginasImagensUploadMaxMb} MB. A imagem será comprimida automaticamente se estiver abaixo desse limite.`,
      });
    }
    return res.status(400).json({ mensagem: err.message });
  }
  if (err) {
    return res.status(400).json({ mensagem: err.message });
  }
  next();
}

module.exports = { uploadPaginaImagem, handlePaginasMulterError, IMAGE_MIMES, IMAGE_EXTS };
