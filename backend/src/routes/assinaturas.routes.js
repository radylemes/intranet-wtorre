const { Router } = require('express');
const forwardGraphToken = require('../middleware/forwardGraphToken.middleware');
const requireJwt = require('../middleware/requireJwt.middleware');
const controller = require('../controllers/assinaturas.controller');

const router = Router();

router.get('/me', forwardGraphToken, controller.me);
router.post('/gerar-script', requireJwt, controller.gerarScript);

module.exports = router;
