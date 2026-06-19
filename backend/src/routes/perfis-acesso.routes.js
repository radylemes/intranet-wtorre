const express = require('express');
const requireJwt = require('../middleware/requireJwt.middleware');
const requireAdmin = require('../middleware/requireAdmin.middleware');
const controller = require('../controllers/perfis-acesso.controller');

const router = express.Router();

router.use(requireJwt, requireAdmin);

router.get('/modulos', controller.listarModulos);
router.get('/perfis', controller.listarPerfis);
router.post('/perfis', controller.criarPerfil);
router.put('/perfis/:id', controller.atualizarPerfil);
router.delete('/perfis/:id', controller.excluirPerfil);
router.put('/perfis/:id/modulos', controller.definirModulosPerfil);

router.get('/usuarios', controller.listarUsuarios);
router.get('/usuarios/buscar', controller.buscarColaboradores);
router.get('/usuarios/:id', controller.obterUsuario);
router.put('/usuarios/:id', controller.atualizarUsuario);
router.patch('/usuarios/:id/perfil', controller.patchPerfilUsuario);
router.patch('/usuarios/:id/ativo', controller.patchAtivoUsuario);
router.delete('/usuarios/:id', controller.excluirUsuario);

module.exports = router;
