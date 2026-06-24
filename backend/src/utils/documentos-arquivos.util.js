const fs = require('fs');
const { resolveStoragePath } = require('./documentos.validation');

function unlinkArquivo(arquivoPath) {
  if (!arquivoPath) return;
  try {
    const filePath = resolveStoragePath(arquivoPath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (_err) {
    // ignora erro de arquivo ausente
  }
}

function unlinkArquivos(arquivoPaths) {
  for (const path of arquivoPaths) {
    unlinkArquivo(path);
  }
}

module.exports = { unlinkArquivo, unlinkArquivos };
