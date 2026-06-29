const { Router } = require('express');
const controller = require('../controllers/camarotes.controller');
const requireJwt = require('../middleware/requireJwt.middleware');
const requireModulo = require('../middleware/requireModulo.middleware');
const requireCamarotesViewer = require('../middleware/requireCamarotesViewer.middleware');

const router = Router();
const adminGuard = [requireJwt, requireModulo('camarotes')];
const viewerGuard = [requireJwt, requireCamarotesViewer];

router.get('/acesso', requireJwt, controller.acesso);
router.get('/dashboard', ...viewerGuard, controller.dashboard);
router.get('/unidades', ...viewerGuard, controller.unidades);

router.get('/visualizadores', ...adminGuard, controller.listarVisualizadores);
router.post('/visualizadores', ...adminGuard, controller.adicionarVisualizador);
router.delete('/visualizadores/:usuarioId', ...adminGuard, controller.removerVisualizador);

router.get('/config', ...adminGuard, controller.obterConfig);
router.put('/config', ...adminGuard, controller.atualizarConfig);
router.get('/gatilhos/:dias/preview', ...adminGuard, controller.previewGatilho);
router.post('/gatilhos/:dias/teste', ...adminGuard, controller.testarGatilho);
router.post('/enviar-alertas', ...adminGuard, controller.enviarAlertas);
router.post('/enviar-resumo', ...adminGuard, controller.enviarResumo);
router.post('/sincronizar', ...adminGuard, controller.sincronizar);
router.get('/sync-log', ...adminGuard, controller.syncLog);
router.get('/alertas-envio-log', ...adminGuard, controller.alertasEnvioLog);
router.get('/alertas-contratos', ...adminGuard, controller.listarContratosEmAlerta);

module.exports = router;
