const fs = require('fs');
const path = require('path');
const { env } = require('../config/env');

const STORED_THUMB_URL_PREFIX = '/api/v1/documentos/thumbs/';

function ensureDocumentosThumbsDir() {
  if (!fs.existsSync(env.documentosThumbsDir)) {
    fs.mkdirSync(env.documentosThumbsDir, { recursive: true, mode: 0o775 });
    return;
  }
  try {
    fs.accessSync(env.documentosThumbsDir, fs.constants.W_OK);
  } catch {
    const err = new Error(
      `Sem permissão de escrita em ${env.documentosThumbsDir}. Ajuste o dono para o usuário do PM2.`
    );
    err.status = 500;
    throw err;
  }
}

function resolveThumbPath(filename) {
  if (!filename || filename.includes('..') || filename.includes('/')) {
    const err = new Error('Arquivo inválido.');
    err.status = 400;
    throw err;
  }
  return path.join(env.documentosThumbsDir, filename);
}

function unlinkThumbnail(thumbnailPath) {
  if (!thumbnailPath) return;
  try {
    const filePath = resolveThumbPath(thumbnailPath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (_err) {
    /* ignore */
  }
}

function enrichDocumentoThumb(doc) {
  if (!doc) return doc;
  const out = { ...doc };
  if (out.thumbnail_path) {
    out.tem_thumb = true;
    out.thumbnail_url = `${STORED_THUMB_URL_PREFIX}${out.thumbnail_path}`;
  } else {
    out.tem_thumb = false;
    out.thumbnail_url = null;
  }
  return out;
}

module.exports = {
  STORED_THUMB_URL_PREFIX,
  ensureDocumentosThumbsDir,
  resolveThumbPath,
  unlinkThumbnail,
  enrichDocumentoThumb,
};
