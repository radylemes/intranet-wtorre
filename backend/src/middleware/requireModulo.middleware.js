const { isCodigoValido } = require('../config/modulos-admin');

function requireModulo(...codigos) {
  for (const codigo of codigos) {
    if (!isCodigoValido(codigo)) {
      throw new Error(`requireModulo: código de módulo inválido "${codigo}"`);
    }
  }

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ mensagem: 'Não autenticado.' });
    }

    if (req.user.perfil === 'ADMIN') {
      return next();
    }

    const modulos = req.userModulos || [];
    const permitido = codigos.some((c) => modulos.includes(c));
    if (!permitido) {
      return res.status(403).json({ mensagem: 'Acesso negado a este módulo administrativo.' });
    }

    return next();
  };
}

module.exports = requireModulo;
