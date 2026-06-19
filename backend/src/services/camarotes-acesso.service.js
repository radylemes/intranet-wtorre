const camarotesRepo = require('../repositories/camarotes.repository');

async function usuarioPodeVisualizar(user, modulos = []) {
  if (!user) return false;
  if (user.perfil === 'ADMIN') return true;
  if (modulos.includes('camarotes')) return true;
  return camarotesRepo.isVisualizador(user.id);
}

module.exports = { usuarioPodeVisualizar };
