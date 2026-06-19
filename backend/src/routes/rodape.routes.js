const { Router } = require('express');
const requireJwt = require('../middleware/requireJwt.middleware');
const requireModulo = require('../middleware/requireModulo.middleware');
const controller = require('../controllers/rodape.controller');

const router = Router();

router.get('/', requireJwt, controller.getFooterPublic);
router.get('/admin', requireJwt, requireModulo('rodape'), controller.getFooterAdmin);
router.put('/', requireJwt, requireModulo('rodape'), controller.putFooter);

module.exports = router;
