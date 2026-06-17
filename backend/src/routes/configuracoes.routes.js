const { Router } = require('express');
const requireJwt = require('../middleware/requireJwt.middleware');
const requireModulo = require('../middleware/requireModulo.middleware');
const controller = require('../controllers/configuracoes.controller');

const router = Router();

router.get('/header-chamado', requireJwt, controller.getHeaderChamadoPublic);
router.get('/', requireJwt, requireModulo('configuracoes'), controller.getConfiguracoes);
router.put(
  '/header-chamado',
  requireJwt,
  requireModulo('configuracoes'),
  controller.putHeaderChamado
);

module.exports = router;
