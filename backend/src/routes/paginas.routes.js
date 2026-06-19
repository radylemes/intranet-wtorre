const { Router } = require('express');
const controller = require('../controllers/paginas.controller');
const requireJwt = require('../middleware/requireJwt.middleware');
const requireModulo = require('../middleware/requireModulo.middleware');
const { uploadPaginaImagem, handlePaginasMulterError } = require('../config/paginas-upload');

const router = Router();

router.get('/publicadas', requireJwt, controller.listarPublicadas);
router.get('/slug/:slug', requireJwt, controller.buscarPorSlug);
router.post(
  '/upload-imagem',
  requireJwt,
  requireModulo('paginas'),
  uploadPaginaImagem.single('imagem'),
  handlePaginasMulterError,
  controller.uploadImagem
);
router.get('/', requireJwt, requireModulo('paginas'), controller.listar);
router.get('/:id', requireJwt, requireModulo('paginas'), controller.obter);
router.post('/', requireJwt, requireModulo('paginas'), controller.criar);
router.put('/:id', requireJwt, requireModulo('paginas'), controller.atualizar);
router.delete('/:id', requireJwt, requireModulo('paginas'), controller.remover);

module.exports = router;
