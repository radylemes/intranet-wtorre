const setorUsuarioService = require('../services/setor-usuario.service');

async function requireSetorResolvido(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ mensagem: 'Não autenticado.' });
  }

  try {
    const setorId = await setorUsuarioService.resolverSetor(req.user);
    if (setorId == null) {
      return res.status(403).json({
        mensagem:
          'Acesso aos dashboards indisponível: seu departamento ainda não está mapeado para um setor. ' +
          'Entre em contato com a TI.',
      });
    }
    req.setorId = setorId;
    if (req.user.setor_id == null) {
      req.user.setor_id = setorId;
    }
    return next();
  } catch (err) {
    return res.status(500).json({
      mensagem: err.message || 'Erro ao verificar setor do usuário.',
    });
  }
}

module.exports = requireSetorResolvido;
