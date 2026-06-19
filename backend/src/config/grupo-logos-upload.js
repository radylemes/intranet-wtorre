const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { env } = require('./env');

const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']);
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
]);

function ensureGrupoLogosDir() {
  if (!fs.existsSync(env.grupoLogosDir)) {
    fs.mkdirSync(env.grupoLogosDir, { recursive: true, mode: 0o775 });
    return;
  }
  try {
    fs.accessSync(env.grupoLogosDir, fs.constants.W_OK);
  } catch {
    const err = new Error(
      `Sem permissão de escrita em ${env.grupoLogosDir}. Ajuste o dono para o usuário do PM2 (ex.: chown www:www).`
    );
    err.status = 500;
    throw err;
  }
}

ensureGrupoLogosDir();

function getExtension(name) {
  return path.extname(name || '').toLowerCase();
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    ensureGrupoLogosDir();
    cb(null, env.grupoLogosDir);
  },
  filename(_req, file, cb) {
    const ext = getExtension(file.originalname) || '.png';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const ext = getExtension(file.originalname);
  if (!ALLOWED_EXT.has(ext)) {
    return cb(new Error('Tipo de arquivo não permitido. Use PNG, JPG, WEBP ou SVG.'));
  }
  if (file.mimetype && !ALLOWED_MIME.has(file.mimetype)) {
    return cb(new Error('Tipo MIME não corresponde à extensão do arquivo.'));
  }
  cb(null, true);
}

const uploadLogo = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.grupoLogosUploadMaxMb * 1024 * 1024 },
});

function handleMulterError(err, _req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        mensagem: `Arquivo excede o limite de ${env.grupoLogosUploadMaxMb} MB.`,
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
  uploadLogo,
  handleMulterError,
  ensureGrupoLogosDir,
  getExtension,
};
