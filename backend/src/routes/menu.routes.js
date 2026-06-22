const { Router } = require('express');
const menuController = require('../controllers/menu.controller');
const topbarController = require('../controllers/topbar.controller');
const homeCarrosselController = require('../controllers/home-carrossel.controller');
const homeSistemasController = require('../controllers/home-sistemas.controller');
const headerChamadoController = require('../controllers/header-chamado.controller');
const requireJwt = require('../middleware/requireJwt.middleware');
const requireModulo = require('../middleware/requireModulo.middleware');
const { uploadLogo, handleMulterError } = require('../config/grupo-logos-upload');
const {
  uploadCarrosselImagem,
  handleMulterError: handleCarrosselMulterError,
} = require('../config/home-carrossel-upload');

const router = Router();

router.get('/carrossel/arquivos/:filename', homeCarrosselController.serveArquivo);

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

router.get('/carrossel', requireJwt, homeCarrosselController.getCarrossel);
router.put('/carrossel', requireJwt, requireModulo('menu'), homeCarrosselController.putCarrossel);

router.get('/sistemas', requireJwt, homeSistemasController.getSistemas);
router.put('/sistemas', requireJwt, requireModulo('menu'), homeSistemasController.putSistemas);

router.get('/header-chamado', requireJwt, headerChamadoController.getHeaderChamado);
router.put('/header-chamado', requireJwt, requireModulo('menu'), headerChamadoController.putHeaderChamado);
router.post(
  '/carrossel/upload',
  requireJwt,
  requireModulo('menu'),
  uploadCarrosselImagem.single('imagem'),
  handleCarrosselMulterError,
  homeCarrosselController.uploadImagem
);

router.get('/', requireJwt, menuController.getPublicTree);
router.get('/admin', requireJwt, requireModulo('menu'), menuController.getAdminTree);
router.put('/reorder', requireJwt, requireModulo('menu'), menuController.reorder);
router.post('/', requireJwt, requireModulo('menu'), menuController.create);
router.put('/:id', requireJwt, requireModulo('menu'), menuController.update);
router.delete('/:id', requireJwt, requireModulo('menu'), menuController.remove);

module.exports = router;
