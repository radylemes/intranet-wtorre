const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { env } = require('./env');

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

function ensureHomeCarrosselDir() {
  if (!fs.existsSync(env.homeCarrosselDir)) {
    fs.mkdirSync(env.homeCarrosselDir, { recursive: true, mode: 0o775 });
    return;
  }
  try {
    fs.accessSync(env.homeCarrosselDir, fs.constants.W_OK);
  } catch {
    const err = new Error(
      `Sem permissão de escrita em ${env.homeCarrosselDir}. Ajuste o dono para o usuário do PM2 (ex.: chown www:www).`
    );
    err.status = 500;
    throw err;
  }
}

function getExtension(name) {
  return path.extname(name || '').toLowerCase();
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    ensureHomeCarrosselDir();
    cb(null, env.homeCarrosselDir);
  },
  filename(_req, file, cb) {
    const ext = getExtension(file.originalname) || '.jpg';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const ext = getExtension(file.originalname);
  if (!ALLOWED_EXT.has(ext)) {
    return cb(new Error('Tipo de arquivo não permitido. Use JPG, PNG ou WEBP.'));
  }
  if (file.mimetype && !ALLOWED_MIME.has(file.mimetype)) {
    return cb(new Error('Tipo MIME não corresponde à extensão do arquivo.'));
  }
  cb(null, true);
}

const uploadCarrosselImagem = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.homeCarrosselUploadMaxMb * 1024 * 1024 },
});

function handleMulterError(err, _req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        mensagem: `Arquivo excede o limite de ${env.homeCarrosselUploadMaxMb} MB.`,
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
  uploadCarrosselImagem,
  handleMulterError,
  ensureHomeCarrosselDir,
  getExtension,
};
