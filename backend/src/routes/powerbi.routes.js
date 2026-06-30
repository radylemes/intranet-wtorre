const { Router } = require('express');
const controller = require('../controllers/powerbi.controller');
const requireJwt = require('../middleware/requireJwt.middleware');
const requireSetorResolvido = require('../middleware/requireSetorResolvido.middleware');
const rateLimitPowerbiEmbed = require('../middleware/rateLimitPowerbiEmbed.middleware');

const router = Router();
const viewerGuard = [requireJwt, requireSetorResolvido, controller.ensurePbiEnabled];

router.get('/reports', ...viewerGuard, controller.listarReports);
router.get(
  '/reports/:reportId/embed-token',
  ...viewerGuard,
  rateLimitPowerbiEmbed,
  controller.obterEmbedToken
);

module.exports = router;
