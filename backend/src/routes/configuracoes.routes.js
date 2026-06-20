const { Router } = require('express');
const requireJwt = require('../middleware/requireJwt.middleware');
const requireModulo = require('../middleware/requireModulo.middleware');
const controller = require('../controllers/configuracoes.controller');

const router = Router();

router.get('/header-chamado', requireJwt, controller.getHeaderChamadoPublic);
router.get('/smtp', requireJwt, requireModulo('configuracoes'), controller.getSmtpConfig);
router.post('/smtp/verificar', requireJwt, requireModulo('configuracoes'), controller.verificarSmtp);
router.post('/smtp/teste', requireJwt, requireModulo('configuracoes'), controller.testarSmtp);
router.get('/', requireJwt, requireModulo('configuracoes'), controller.getConfiguracoes);
router.put(
  '/header-chamado',
  requireJwt,
  requireModulo('configuracoes'),
  controller.putHeaderChamado
);
router.put('/smtp', requireJwt, requireModulo('configuracoes'), controller.putSmtpConfig);

module.exports = router;
