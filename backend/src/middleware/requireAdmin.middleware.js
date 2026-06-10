function requireAdmin(req, res, next) {
  if (!req.user || req.user.perfil !== 'ADMIN') {
    return res.status(403).json({ mensagem: 'Acesso restrito a administradores.' });
  }
  next();
}

module.exports = requireAdmin;
