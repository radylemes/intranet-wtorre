const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const { env } = require('./env');

const VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const THUMB_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function ensureTmpDir() {
  if (!fs.existsSync(env.treinamentosTmpDir)) {
    fs.mkdirSync(env.treinamentosTmpDir, { recursive: true });
  }
}

ensureTmpDir();

function getExtension(originalname) {
  const ext = path.extname(originalname || '').toLowerCase().replace(/^\./, '');
  return ext || 'bin';
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    ensureTmpDir();
    cb(null, env.treinamentosTmpDir);
  },
  filename(_req, file, cb) {
    cb(null, `${crypto.randomUUID()}.${getExtension(file.originalname)}`);
  },
});

function fileFilter(_req, file, cb) {
  const field = file.fieldname;
  if (field === 'video') {
    if (!VIDEO_MIMES.has(file.mimetype)) {
      return cb(new Error('Tipo de vídeo não permitido. Use MP4, WebM ou QuickTime.'));
    }
    return cb(null, true);
  }
  if (field === 'thumb') {
    if (!THUMB_MIMES.has(file.mimetype)) {
      return cb(new Error('Thumbnail deve ser JPEG, PNG ou WebP.'));
    }
    return cb(null, true);
  }
  return cb(new Error('Campo de upload inválido.'));
}

const uploadTreinamento = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.treinamentosMaxMb * 1024 * 1024 },
});

function handleTreinamentosMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        mensagem: `Arquivo excede o limite de ${env.treinamentosMaxMb} MB.`,
      });
    }
    return res.status(400).json({ mensagem: err.message });
  }
  if (err) {
    return res.status(400).json({ mensagem: err.message });
  }
  next();
}

module.exports = { uploadTreinamento, handleTreinamentosMulterError, VIDEO_MIMES, THUMB_MIMES };
