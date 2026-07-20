const { Router } = require('express');
const controller = require('../controllers/followup.controller');
const requireJwt = require('../middleware/requireJwt.middleware');
const requireModulo = require('../middleware/requireModulo.middleware');

const router = Router();
const adminGuard = [requireJwt, requireModulo('followup-suprimentos')];

router.get('/minhas', requireJwt, controller.minhas);
router.get('/resumo', requireJwt, controller.resumo);
router.get('/filiais', requireJwt, controller.filiais);
router.get('/solicitacao/:numero', requireJwt, controller.solicitacaoPorNumero);

router.get('/config', ...adminGuard, controller.obterConfig);
router.put('/config', ...adminGuard, controller.atualizarConfig);
router.post('/testar-conexao', ...adminGuard, controller.testarConexao);
router.post('/sincronizar', ...adminGuard, controller.sincronizar);
router.get('/status-sync', ...adminGuard, controller.statusSync);

module.exports = router;
