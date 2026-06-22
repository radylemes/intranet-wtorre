const { Router } = require('express');
const controller = require('../controllers/comunicados.controller');
const catController = require('../controllers/comunicado-categorias.controller');
const requireJwt = require('../middleware/requireJwt.middleware');
const requireModulo = require('../middleware/requireModulo.middleware');

const router = Router();

router.get('/', requireJwt, controller.listarPublicos);
router.get('/admin', requireJwt, requireModulo('comunicados'), controller.listarAdmin);

router.get('/categorias', requireJwt, catController.listarPublicas);
router.get(
  '/categorias/admin',
  requireJwt,
  requireModulo('comunicados'),
  catController.listarAdmin
);
router.get(
  '/categorias/:catId',
  requireJwt,
  requireModulo('comunicados'),
  catController.obter
);
router.post('/categorias', requireJwt, requireModulo('comunicados'), catController.criar);
router.put(
  '/categorias/:catId',
  requireJwt,
  requireModulo('comunicados'),
  catController.atualizar
);
router.delete(
  '/categorias/:catId',
  requireJwt,
  requireModulo('comunicados'),
  catController.remover
);

router.get('/:id', requireJwt, requireModulo('comunicados'), controller.obter);
router.post('/', requireJwt, requireModulo('comunicados'), controller.criar);
router.put('/:id', requireJwt, requireModulo('comunicados'), controller.atualizar);
router.delete('/:id', requireJwt, requireModulo('comunicados'), controller.remover);

module.exports = router;
