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
const { ensureDocumentosThumbsDir } = require('../utils/documentos-thumbnail.util');

const THUMB_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const THUMB_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

function ensureStorageDir() {
  if (!fs.existsSync(env.storageDir)) {
    fs.mkdirSync(env.storageDir, { recursive: true });
  }
}

ensureStorageDir();

const storage = multer.diskStorage({
  destination(_req, file, cb) {
    if (file.fieldname === 'thumb') {
      try {
        ensureDocumentosThumbsDir();
        cb(null, env.documentosThumbsDir);
      } catch (err) {
        cb(err);
      }
      return;
    }
    ensureStorageDir();
    cb(null, env.storageDir);
  },
  filename(_req, file, cb) {
    const ext = getExtension(file.originalname);
    if (file.fieldname === 'thumb') {
      const thumbExt = THUMB_EXT.has(`.${ext}`) ? ext : 'jpg';
      cb(null, `${crypto.randomUUID()}.${thumbExt}`);
      return;
    }
    cb(null, `${crypto.randomUUID()}.${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  if (file.fieldname === 'thumb') {
    const ext = `.${getExtension(file.originalname)}`;
    if (!THUMB_EXT.has(ext)) {
      return cb(new Error('Thumbnail: use PNG, JPG ou WEBP.'));
    }
    if (file.mimetype && !THUMB_MIME.has(file.mimetype)) {
      return cb(new Error('Thumbnail: tipo MIME inválido.'));
    }
    return cb(null, true);
  }

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

const uploadFields = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.maxUploadMb * 1024 * 1024,
  },
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

module.exports = {
  upload,
  uploadFields,
  handleMulterError,
};
