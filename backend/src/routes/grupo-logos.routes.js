const { Router } = require('express');
const topbarController = require('../controllers/topbar.controller');

const router = Router();

router.get('/:filename', topbarController.serveLogoFile);

module.exports = router;
