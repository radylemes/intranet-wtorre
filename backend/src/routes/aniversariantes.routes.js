const { Router } = require('express');
const controller = require('../controllers/aniversariantes.controller');
const requireJwt = require('../middleware/requireJwt.middleware');

const router = Router();

router.get('/', requireJwt, controller.list);

module.exports = router;
