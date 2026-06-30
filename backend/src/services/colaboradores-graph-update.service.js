const colaboradoresRepo = require('../repositories/colaboradores.repository');
const tenantsRepo = require('../repositories/tenants.repository');
const syncService = require('./colaboradores.sync');
const { diffEditableFields } = require('../utils/colaboradores.graph-patch');
const { ensureRegistered, updateUserExtensionWithRetry } = require('./colaboradores-schema-extension.service');

function graphErrorHint(status) {
  if (status === 403) {
    return ' Verifique a permissão User.ReadWrite.All no Azure AD.';
  }
  return '';
}

async function updateColaboradorGraph(colaboradorId, campos, auditMeta, options = {}) {
  const {
    skipSync = false,
    auditAction = 'COLABORADORES_UPDATE_GRAPH',
  } = options;

  const colaborador = await colaboradoresRepo.findAdminById(colaboradorId);
  if (!colaborador) {
    const err = new Error('Colaborador não encontrado.');
    err.status = 404;
    throw err;
  }

  const tenant = await tenantsRepo.findActiveWithSecret(colaborador.tenant_id);
  if (!tenant) {
    const err = new Error('Tenant Azure não configurado ou inativo.');
    err.status = 400;
    throw err;
  }

  await ensureRegistered(tenant);

  const { alteracoes, erros, patch } = diffEditableFields(campos, colaborador, tenant.client_id);

  if (erros.length) {
    const err = new Error(erros.join(' '));
    err.status = 400;
    throw err;
  }

  if (!alteracoes.length) {
    return { alterado: false, alteracoes: [], colaborador };
  }

  try {
    await updateUserExtensionWithRetry(tenant, colaborador.ad_id, patch);
  } catch (graphErr) {
    const hint = graphErrorHint(graphErr.status);
    const err = new Error(`${graphErr.message || 'Erro ao atualizar no Graph.'}${hint}`);
    err.status = graphErr.status || 502;
    throw err;
  }

  if (auditMeta?.log) {
    await auditMeta.log({
      userId: auditMeta.userId,
      action: auditAction,
      provider: 'graph',
      email: colaborador.email,
      requestId: auditMeta.requestId,
      ip: auditMeta.ip,
    });
  }

  if (!skipSync) {
    await syncService.sincronizarColaboradores();
  }

  const atualizado = await colaboradoresRepo.findAdminById(colaboradorId);
  return { alterado: true, alteracoes, colaborador: atualizado };
}

module.exports = {
  updateColaboradorGraph,
  graphErrorHint,
};
