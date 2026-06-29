const multer = require('multer');

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAX_BYTES = 5 * 1024 * 1024;

const storage = multer.memoryStorage();

const uploadColaboradoresXlsx = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter(_req, file, cb) {
    const mime = file.mimetype?.toLowerCase();
    const ext = (file.originalname || '').toLowerCase();
    if (mime === XLSX_MIME || ext.endsWith('.xlsx')) {
      return cb(null, true);
    }
    return cb(new Error('Envie um arquivo .xlsx válido.'));
  },
});

function handleColaboradoresMulterError(err, _req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ mensagem: 'Arquivo excede o limite de 5 MB.' });
    }
    return res.status(400).json({ mensagem: err.message });
  }
  if (err) {
    return res.status(400).json({ mensagem: err.message || 'Erro no upload.' });
  }
  return next();
}

module.exports = { uploadColaboradoresXlsx, handleColaboradoresMulterError, XLSX_MIME };
