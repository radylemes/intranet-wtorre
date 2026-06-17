const { Router } = require('express');
const menuController = require('../controllers/menu.controller');
const requireJwt = require('../middleware/requireJwt.middleware');
const requireModulo = require('../middleware/requireModulo.middleware');

const router = Router();

router.get('/', requireJwt, menuController.getPublicTree);
router.get('/admin', requireJwt, requireModulo('menu'), menuController.getAdminTree);
router.put('/reorder', requireJwt, requireModulo('menu'), menuController.reorder);
router.post('/', requireJwt, requireModulo('menu'), menuController.create);
router.put('/:id', requireJwt, requireModulo('menu'), menuController.update);
router.delete('/:id', requireJwt, requireModulo('menu'), menuController.remove);

module.exports = router;
