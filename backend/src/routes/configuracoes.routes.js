const { Router } = require('express');
const requireJwt = require('../middleware/requireJwt.middleware');
const requireModulo = require('../middleware/requireModulo.middleware');
const controller = require('../controllers/configuracoes.controller');

const router = Router();

router.get('/header-chamado', requireJwt, controller.getHeaderChamadoPublic);

router.get('/email', requireJwt, requireModulo('configuracoes'), controller.getEmailConfig);
router.put('/email', requireJwt, requireModulo('configuracoes'), controller.putEmailConfig);
router.post('/email/verificar', requireJwt, requireModulo('configuracoes'), controller.verificarEmail);
router.post('/email/teste', requireJwt, requireModulo('configuracoes'), controller.testarEmail);

router.get('/smtp', requireJwt, requireModulo('configuracoes'), controller.getSmtpConfig);
router.post('/smtp/verificar', requireJwt, requireModulo('configuracoes'), controller.verificarSmtp);
router.post('/smtp/teste', requireJwt, requireModulo('configuracoes'), controller.testarSmtp);
router.put('/smtp', requireJwt, requireModulo('configuracoes'), controller.putSmtpConfig);

router.get('/bid', requireJwt, requireModulo('configuracoes'), controller.getBidConfig);
router.put('/bid', requireJwt, requireModulo('configuracoes'), controller.putBidConfig);
router.post('/bid/testar', requireJwt, requireModulo('configuracoes'), controller.testarBidConfig);
router.post('/bid/sincronizar', requireJwt, requireModulo('configuracoes'), controller.sincronizarBidConfig);

module.exports = router;
