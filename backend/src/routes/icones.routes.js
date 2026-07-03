const { Router } = require('express');
const controller = require('../controllers/icones-custom.controller');
const requireJwt = require('../middleware/requireJwt.middleware');
const requireModulo = require('../middleware/requireModulo.middleware');
const {
  uploadIconeCustom,
  handleMulterError,
} = require('../config/icones-custom-upload');

const router = Router();

router.get('/custom/:filename', controller.serveFile);
router.post(
  '/custom/upload',
  requireJwt,
  requireModulo('menu', 'documentos'),
  uploadIconeCustom.single('svg'),
  handleMulterError,
  controller.upload
);

module.exports = router;
