const { Router } = require('express');
const topbarController = require('../controllers/topbar.controller');

const router = Router();

router.get('/topbar', topbarController.getTopbarPublic);

module.exports = router;
