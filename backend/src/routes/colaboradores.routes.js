const { Router } = require('express');
const controller = require('../controllers/colaboradores.controller');
const requireJwt = require('../middleware/requireJwt.middleware');
const requireModulo = require('../middleware/requireModulo.middleware');
const {
  uploadColaboradoresXlsx,
  handleColaboradoresMulterError,
} = require('../config/colaboradores-upload');

const router = Router();

router.get('/', requireJwt, controller.list);
router.get('/departamentos', requireJwt, controller.departamentos);
router.get('/admin/stats', requireJwt, requireModulo('colaboradores'), controller.adminStats);
router.get('/admin/filtros', requireJwt, requireModulo('colaboradores'), controller.adminFiltros);
router.get('/admin/export', requireJwt, requireModulo('colaboradores'), controller.adminExport);
router.post(
  '/admin/import/preview',
  requireJwt,
  requireModulo('colaboradores'),
  uploadColaboradoresXlsx.single('arquivo'),
  handleColaboradoresMulterError,
  controller.adminImportPreview
);
router.post(
  '/admin/import/aplicar',
  requireJwt,
  requireModulo('colaboradores'),
  uploadColaboradoresXlsx.single('arquivo'),
  handleColaboradoresMulterError,
  controller.adminImportAplicar
);
router.post(
  '/admin/migrate-extensions',
  requireJwt,
  requireModulo('colaboradores'),
  controller.adminMigrateExtensions
);
router.get('/admin', requireJwt, requireModulo('colaboradores'), controller.adminList);
router.patch('/admin/:id', requireJwt, requireModulo('colaboradores'), controller.adminUpdateGraph);
router.get('/admin/:id', requireJwt, requireModulo('colaboradores'), controller.adminDetail);
router.post('/sync', requireJwt, requireModulo('colaboradores'), controller.sync);
router.get('/:id/foto', requireJwt, controller.foto);

module.exports = router;
