const { Router } = require('express');
const controller = require('../controllers/storage-containers.controller');
const requireJwt = require('../middleware/requireJwt.middleware');
const requireModulo = require('../middleware/requireModulo.middleware');

const router = Router();

router.get('/', requireJwt, requireModulo('containers'), controller.listar);
router.post('/', requireJwt, requireModulo('containers'), controller.criar);
router.put('/:id', requireJwt, requireModulo('containers'), controller.atualizar);
router.delete('/:id', requireJwt, requireModulo('containers'), controller.excluir);

module.exports = router;
