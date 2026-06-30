const { env } = require('../../config/env');
const powerbiRepo = require('../../repositories/powerbi.repository');

async function buildIdentities({ user, setorId, datasetId }) {
  const username = user.email;
  if (!username) {
    const err = new Error('Usuário sem e-mail para identidade RLS.');
    err.status = 403;
    throw err;
  }

  if (!datasetId) {
    const err = new Error('Relatório sem dataset configurado.');
    err.status = 400;
    throw err;
  }

  if (env.pbiRlsMode === 'dynamic') {
    const role = env.pbiRlsDynamicRole;
    if (!role) {
      const err = new Error('Role RLS dinâmica não configurada.');
      err.status = 503;
      throw err;
    }
    return [
      {
        username,
        roles: [role],
        datasets: [datasetId],
      },
    ];
  }

  const rlsRole = await powerbiRepo.getRlsRolePorSetor(setorId);
  if (!rlsRole) {
    const err = new Error('Setor sem permissão de dados configurada.');
    err.status = 403;
    throw err;
  }

  return [
    {
      username,
      roles: [rlsRole],
      datasets: [datasetId],
    },
  ];
}

module.exports = {
  buildIdentities,
};
