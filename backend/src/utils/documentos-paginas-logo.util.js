const fs = require('fs');
const path = require('path');
const { env } = require('../config/env');

const STORED_URL_PREFIX = '/api/v1/documentos/paginas/logos/';

function isStoredPaginaLogoUrl(url) {
  return typeof url === 'string' && url.includes(STORED_URL_PREFIX);
}

function filenameFromPaginaLogoUrl(url) {
  if (!isStoredPaginaLogoUrl(url)) return null;
  return path.basename(url.split('?')[0]);
}

function deleteStoredPaginaLogoFile(url) {
  const filename = filenameFromPaginaLogoUrl(url);
  if (!filename) return;
  const filePath = path.join(env.documentosPaginasLogosDir, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

async function cleanupOrphanPaginaLogo(url, paginaRepo, excludeId = null) {
  if (!isStoredPaginaLogoUrl(url)) return;

  const paginas = await paginaRepo.findAll();
  const stillUsed = paginas.some(
    (p) => p.logo_url === url && (excludeId == null || p.id !== excludeId)
  );
  if (!stillUsed) {
    deleteStoredPaginaLogoFile(url);
  }
}

module.exports = {
  STORED_URL_PREFIX,
  isStoredPaginaLogoUrl,
  filenameFromPaginaLogoUrl,
  deleteStoredPaginaLogoFile,
  cleanupOrphanPaginaLogo,
};
