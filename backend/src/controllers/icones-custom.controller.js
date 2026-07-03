const fs = require('fs');
const path = require('path');
const { env } = require('../config/env');
const { ensureIconesCustomDir } = require('../config/icones-custom-upload');
const { sanitizeSvgFile } = require('../utils/svg-sanitize.util');

const STORED_URL_PREFIX = '/api/v1/icones/custom/';

async function upload(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ mensagem: 'Arquivo SVG é obrigatório.' });
    }

    const raw = fs.readFileSync(req.file.path);
    const sanitized = sanitizeSvgFile(raw, req.file.originalname);
    fs.writeFileSync(req.file.path, sanitized, 'utf8');

    const filename = path.basename(req.file.path);
    const id = filename.replace(/\.svg$/i, '');
    const icone = `custom:${id}`;
    const url = `${STORED_URL_PREFIX}${filename}`;

    return res.json({ icone, url });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function serveFile(req, res) {
  try {
    ensureIconesCustomDir();
    const filename = path.basename(req.params.filename || '');
    if (!filename || filename.includes('..') || !filename.endsWith('.svg')) {
      return res.status(400).json({ mensagem: 'Arquivo inválido.' });
    }

    const filePath = path.join(env.iconesCustomDir, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ mensagem: 'Arquivo não encontrado.' });
    }

    res.set('Cache-Control', 'public, max-age=86400');
    res.set('Content-Type', 'image/svg+xml');
    return res.sendFile(filePath);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

module.exports = {
  upload,
  serveFile,
  STORED_URL_PREFIX,
};
