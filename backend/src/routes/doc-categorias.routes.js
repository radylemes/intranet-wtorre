const { Router } = require('express');
const controller = require('../controllers/doc-categorias.controller');
const requireJwt = require('../middleware/requireJwt.middleware');
const requireAdmin = require('../middleware/requireAdmin.middleware');

const router = Router();

router.get('/', requireJwt, controller.getPublicTree);
router.get('/admin', requireJwt, requireAdmin, controller.getAdminTree);
router.put('/reorder', requireJwt, requireAdmin, controller.reorder);
router.post('/', requireJwt, requireAdmin, controller.create);
router.put('/:id', requireJwt, requireAdmin, controller.update);
router.delete('/:id', requireJwt, requireAdmin, controller.remove);

module.exports = router;
