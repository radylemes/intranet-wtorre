const multer = require('multer');

const MAX_BYTES = 512 * 1024;

const uploadSalasLogo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const ok =
      /^image\/(svg\+xml|png|jpeg)$/.test(file.mimetype) ||
      ['.svg', '.png', '.jpg', '.jpeg'].some((ext) =>
        file.originalname?.toLowerCase().endsWith(ext)
      );
    if (!ok) {
      const err = new Error('Formato de imagem inválido. Use SVG, PNG ou JPEG.');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

function handleSalasLogoMulterError(err, _req, res, next) {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Logo excede o tamanho máximo de 512 KB.'
        : 'Falha no upload do logo.';
    return res.status(400).json({ mensagem: message });
  }
  if (err?.status) {
    return res.status(err.status).json({ mensagem: err.message });
  }
  return next(err);
}

module.exports = { uploadSalasLogo, handleSalasLogoMulterError };
