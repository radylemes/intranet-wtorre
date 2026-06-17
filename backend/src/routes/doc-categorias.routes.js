const { Router } = require('express');
const controller = require('../controllers/doc-categorias.controller');
const requireJwt = require('../middleware/requireJwt.middleware');
const requireModulo = require('../middleware/requireModulo.middleware');

const router = Router();

router.get('/', requireJwt, controller.getPublicTree);
router.get('/admin', requireJwt, requireModulo('documentos'), controller.getAdminTree);
router.put('/reorder', requireJwt, requireModulo('documentos'), controller.reorder);
router.post('/', requireJwt, requireModulo('documentos'), controller.create);
router.put('/:id', requireJwt, requireModulo('documentos'), controller.update);
router.delete('/:id', requireJwt, requireModulo('documentos'), controller.remove);

module.exports = router;
