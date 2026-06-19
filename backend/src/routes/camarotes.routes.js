const { Router } = require('express');
const controller = require('../controllers/camarotes.controller');
const requireJwt = require('../middleware/requireJwt.middleware');
const requireModulo = require('../middleware/requireModulo.middleware');

const router = Router();
const guard = [requireJwt, requireModulo('camarotes')];

router.get('/dashboard', ...guard, controller.dashboard);
router.get('/unidades', ...guard, controller.unidades);
router.get('/config', ...guard, controller.obterConfig);
router.put('/config', ...guard, controller.atualizarConfig);
router.post('/sincronizar', ...guard, controller.sincronizar);
router.get('/sync-log', ...guard, controller.syncLog);
router.post('/enviar-resumo', ...guard, controller.enviarResumo);

module.exports = router;
