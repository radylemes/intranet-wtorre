const { Router } = require('express');
const requireJwt = require('../middleware/requireJwt.middleware');
const controller = require('../controllers/content-version.controller');

const router = Router();

router.get('/', requireJwt, controller.getVersions);

module.exports = router;
