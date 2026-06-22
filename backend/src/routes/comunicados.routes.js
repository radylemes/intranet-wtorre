const { Router } = require('express');
const controller = require('../controllers/comunicados.controller');
const requireJwt = require('../middleware/requireJwt.middleware');
const requireModulo = require('../middleware/requireModulo.middleware');

const router = Router();

router.get('/', requireJwt, controller.listarPublicos);
router.get('/admin', requireJwt, requireModulo('comunicados'), controller.listarAdmin);
router.get('/:id', requireJwt, requireModulo('comunicados'), controller.obter);
router.post('/', requireJwt, requireModulo('comunicados'), controller.criar);
router.put('/:id', requireJwt, requireModulo('comunicados'), controller.atualizar);
router.delete('/:id', requireJwt, requireModulo('comunicados'), controller.remover);

module.exports = router;
