const { Router } = require('express');
const controller = require('../controllers/colaboradores.controller');
const requireJwt = require('../middleware/requireJwt.middleware');
const requireAdmin = require('../middleware/requireAdmin.middleware');

const router = Router();

router.get('/', requireJwt, controller.list);
router.get('/departamentos', requireJwt, controller.departamentos);
router.post('/sync', requireJwt, requireAdmin, controller.sync);
router.get('/:id/foto', requireJwt, controller.foto);

module.exports = router;
