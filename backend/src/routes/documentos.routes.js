const { Router } = require('express');
const controller = require('../controllers/documentos.controller');
const requireJwt = require('../middleware/requireJwt.middleware');
const requireModulo = require('../middleware/requireModulo.middleware');
const { upload, handleMulterError } = require('../config/upload');

const router = Router();

router.get('/', requireJwt, controller.list);
router.get('/:id/view', requireJwt, controller.view);
router.get('/:id/download', requireJwt, controller.download);
router.post(
  '/',
  requireJwt,
  requireModulo('documentos'),
  upload.single('arquivo'),
  handleMulterError,
  controller.upload
);
router.put('/:id', requireJwt, requireModulo('documentos'), controller.update);
router.delete('/:id', requireJwt, requireModulo('documentos'), controller.remove);

module.exports = router;
