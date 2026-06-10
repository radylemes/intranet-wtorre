const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { env } = require('./env');
const {
  getExtension,
  isAllowedExtension,
  isAllowedMime,
} = require('../utils/documentos.validation');

function ensureStorageDir() {
  if (!fs.existsSync(env.storageDir)) {
    fs.mkdirSync(env.storageDir, { recursive: true });
  }
}

ensureStorageDir();

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    ensureStorageDir();
    cb(null, env.storageDir);
  },
  filename(_req, file, cb) {
    const ext = getExtension(file.originalname);
    cb(null, `${crypto.randomUUID()}.${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const ext = getExtension(file.originalname);
  if (!isAllowedExtension(ext)) {
    return cb(new Error('Tipo de arquivo não permitido.'));
  }
  if (!isAllowedMime(ext, file.mimetype)) {
    return cb(new Error('Tipo MIME não corresponde à extensão do arquivo.'));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.maxUploadMb * 1024 * 1024 },
});

function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        mensagem: `Arquivo excede o limite de ${env.maxUploadMb} MB.`,
      });
    }
    return res.status(400).json({ mensagem: err.message });
  }
  if (err) {
    return res.status(400).json({ mensagem: err.message });
  }
  next();
}

module.exports = { upload, handleMulterError };
