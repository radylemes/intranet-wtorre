const { Router } = require('express');
const menuController = require('../controllers/menu.controller');
const topbarController = require('../controllers/topbar.controller');
const requireJwt = require('../middleware/requireJwt.middleware');
const requireModulo = require('../middleware/requireModulo.middleware');
const { uploadLogo, handleMulterError } = require('../config/grupo-logos-upload');

const router = Router();

router.get('/topbar', requireJwt, topbarController.getTopbar);
router.put('/topbar', requireJwt, requireModulo('menu'), topbarController.putTopbar);
router.post(
  '/topbar/logos/:logoId/imagem',
  requireJwt,
  requireModulo('menu'),
  uploadLogo.single('imagem'),
  handleMulterError,
  topbarController.uploadLogoImagem
);

router.get('/', requireJwt, menuController.getPublicTree);
router.get('/admin', requireJwt, requireModulo('menu'), menuController.getAdminTree);
router.put('/reorder', requireJwt, requireModulo('menu'), menuController.reorder);
router.post('/', requireJwt, requireModulo('menu'), menuController.create);
router.put('/:id', requireJwt, requireModulo('menu'), menuController.update);
router.delete('/:id', requireJwt, requireModulo('menu'), menuController.remove);

module.exports = router;
