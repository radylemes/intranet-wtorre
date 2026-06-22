const repo = require('../repositories/solicitacao-colaborador.repository');

async function usuarioPodeVisualizar(user, modulos = []) {
  if (!user) return false;
  if (user.perfil === 'ADMIN') return true;
  if (modulos.includes('solicitacao-colaborador')) return true;
  return repo.isVisualizador(user.id);
}

module.exports = { usuarioPodeVisualizar };
