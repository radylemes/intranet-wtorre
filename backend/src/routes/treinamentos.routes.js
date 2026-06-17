const { Router } = require('express');
const controller = require('../controllers/treinamentos.controller');
const requireJwt = require('../middleware/requireJwt.middleware');
const requireModulo = require('../middleware/requireModulo.middleware');
const {
  uploadTreinamento,
  handleTreinamentosMulterError,
} = require('../config/treinamentos-upload');

const router = Router();

router.get('/', requireJwt, controller.listar);
router.get('/admin', requireJwt, requireModulo('treinamentos'), controller.listarAdmin);
router.get('/:id/playback', requireJwt, controller.playback);
router.get('/:id/thumb', requireJwt, controller.thumb);
router.get('/:id', requireJwt, controller.obter);
router.post(
  '/',
  requireJwt,
  requireModulo('treinamentos'),
  uploadTreinamento.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumb', maxCount: 1 },
  ]),
  handleTreinamentosMulterError,
  controller.criar
);
router.put(
  '/:id',
  requireJwt,
  requireModulo('treinamentos'),
  uploadTreinamento.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumb', maxCount: 1 },
  ]),
  handleTreinamentosMulterError,
  controller.atualizar
);
router.delete('/:id', requireJwt, requireModulo('treinamentos'), controller.excluir);

module.exports = router;
