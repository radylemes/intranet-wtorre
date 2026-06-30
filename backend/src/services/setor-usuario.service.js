const departamentoSetorRepo = require('../repositories/departamento-setor.repository');
const setorUsuarioRepo = require('../repositories/setor-usuario.repository');
const powerbiAccessLogRepo = require('../repositories/powerbi-access-log.repository');

const setorNaoResolvidoLogados = new Set();

async function resolverSetor(user) {
  if (!user?.id) return null;

  if (user.setor_id != null) {
    return user.setor_id;
  }

  const departamento = await setorUsuarioRepo.getDepartamentoColaborador(user.microsoft_id);
  if (!departamento) {
    await logSetorNaoResolvidoOnce(user, null);
    return null;
  }

  const mapa = await departamentoSetorRepo.findByDepartamento(departamento);
  if (!mapa?.setor_id) {
    await logSetorNaoResolvidoOnce(user, departamento);
    return null;
  }

  await setorUsuarioRepo.updateSetorId(user.id, mapa.setor_id);
  return mapa.setor_id;
}

async function logSetorNaoResolvidoOnce(user, departamento) {
  const key = `${user.id}:${departamento || ''}`;
  if (setorNaoResolvidoLogados.has(key)) return;
  setorNaoResolvidoLogados.add(key);
  await powerbiAccessLogRepo.logSetorNaoResolvido({
    userId: user.id,
    email: user.email,
    departamento,
  });
}

module.exports = {
  resolverSetor,
};
