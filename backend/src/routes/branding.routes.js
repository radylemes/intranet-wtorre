const { Router } = require('express');
const topbarController = require('../controllers/topbar.controller');
const loginController = require('../controllers/login.controller');

const router = Router();

router.get('/topbar', topbarController.getTopbarPublic);
router.get('/login', loginController.getLoginPublic);

module.exports = router;
