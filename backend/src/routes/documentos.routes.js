const { Router } = require('express');
const controller = require('../controllers/documentos.controller');
const paginasController = require('../controllers/documentos-paginas.controller');
const setoresController = require('../controllers/documentos-setores.controller');
const requireJwt = require('../middleware/requireJwt.middleware');
const requireModulo = require('../middleware/requireModulo.middleware');
const { uploadFields, handleMulterError } = require('../config/upload');
const {
  uploadPaginaLogo,
  handleMulterError: handlePaginaLogoMulterError,
} = require('../config/documentos-paginas-logo-upload');

const router = Router();

router.get('/paginas/logos/:filename', paginasController.serveLogoFile);
router.get('/paginas', requireJwt, paginasController.listPublic);
router.get('/paginas/admin', requireJwt, requireModulo('documentos'), paginasController.listAdmin);
router.post('/paginas/admin', requireJwt, requireModulo('documentos'), paginasController.create);
router.post(
  '/paginas/admin/upload-logo',
  requireJwt,
  requireModulo('documentos'),
  uploadPaginaLogo.single('imagem'),
  handlePaginaLogoMulterError,
  paginasController.uploadLogo
);
router.get('/paginas/admin', requireJwt, requireModulo('documentos'), paginasController.listAdmin);
router.post('/paginas/admin', requireJwt, requireModulo('documentos'), paginasController.create);
router.put('/paginas/admin/:id', requireJwt, requireModulo('documentos'), paginasController.update);
router.delete('/paginas/admin/:id', requireJwt, requireModulo('documentos'), paginasController.remove);

router.get('/setores', requireJwt, setoresController.listPublic);
router.get('/setores/admin', requireJwt, requireModulo('documentos'), setoresController.listAdmin);
router.post('/setores/admin', requireJwt, requireModulo('documentos'), setoresController.create);
router.put('/setores/admin/:id', requireJwt, requireModulo('documentos'), setoresController.update);
router.delete('/setores/admin/:id', requireJwt, requireModulo('documentos'), setoresController.remove);

router.get('/', requireJwt, controller.list);
router.get('/thumbs/:filename', requireJwt, controller.serveThumb);
router.get('/:id/thumb/stream', requireJwt, controller.thumbStream);
router.get('/:id/view', requireJwt, controller.view);
router.get('/:id/download', requireJwt, controller.download);
router.post(
  '/',
  requireJwt,
  requireModulo('documentos'),
  uploadFields.fields([
    { name: 'arquivo', maxCount: 1 },
    { name: 'thumb', maxCount: 1 },
  ]),
  handleMulterError,
  controller.upload
);
router.put(
  '/:id',
  requireJwt,
  requireModulo('documentos'),
  uploadFields.fields([{ name: 'thumb', maxCount: 1 }]),
  handleMulterError,
  controller.update
);
router.delete('/:id', requireJwt, requireModulo('documentos'), controller.remove);

module.exports = router;
