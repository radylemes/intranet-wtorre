const { Router } = require('express');
const menuController = require('../controllers/menu.controller');
const requireJwt = require('../middleware/requireJwt.middleware');
const requireAdmin = require('../middleware/requireAdmin.middleware');

const router = Router();

router.get('/', requireJwt, menuController.getPublicTree);
router.get('/admin', requireJwt, requireAdmin, menuController.getAdminTree);
router.put('/reorder', requireJwt, requireAdmin, menuController.reorder);
router.post('/', requireJwt, requireAdmin, menuController.create);
router.put('/:id', requireJwt, requireAdmin, menuController.update);
router.delete('/:id', requireJwt, requireAdmin, menuController.remove);

module.exports = router;
