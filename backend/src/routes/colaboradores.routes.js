const { Router } = require('express');
const controller = require('../controllers/colaboradores.controller');
const requireJwt = require('../middleware/requireJwt.middleware');
const requireModulo = require('../middleware/requireModulo.middleware');

const router = Router();

router.get('/', requireJwt, controller.list);
router.get('/departamentos', requireJwt, controller.departamentos);
router.get('/admin/stats', requireJwt, requireModulo('colaboradores'), controller.adminStats);
router.get('/admin', requireJwt, requireModulo('colaboradores'), controller.adminList);
router.get('/admin/:id', requireJwt, requireModulo('colaboradores'), controller.adminDetail);
router.post('/sync', requireJwt, requireModulo('colaboradores'), controller.sync);
router.get('/:id/foto', requireJwt, controller.foto);

module.exports = router;
