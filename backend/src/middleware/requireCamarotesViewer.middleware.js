const { usuarioPodeVisualizar } = require('../services/camarotes-acesso.service');

async function requireCamarotesViewer(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ mensagem: 'Não autenticado.' });
  }

  try {
    const permitido = await usuarioPodeVisualizar(req.user, req.userModulos || []);
    if (!permitido) {
      return res.status(403).json({ mensagem: 'Acesso negado ao dashboard de Camarotes.' });
    }
    return next();
  } catch (err) {
    return res.status(500).json({ mensagem: err.message || 'Erro ao verificar acesso.' });
  }
}

module.exports = requireCamarotesViewer;
