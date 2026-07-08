const { Router } = require('express');
const bidController = require('../controllers/bid.controller');
const requireJwt = require('../middleware/requireJwt.middleware');

const router = Router();

router.get('/eventos-abertos', requireJwt, bidController.getEventosAbertos);
router.get('/meus-premios', requireJwt, bidController.getMeusPremios);

module.exports = router;
