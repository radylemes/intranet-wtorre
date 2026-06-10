const tenantsRepo = require('../repositories/tenants.repository');
const colaboradoresRepo = require('../repositories/colaboradores.repository');
const empresaDominiosRepo = require('../repositories/empresa-dominios.repository');
const graphService = require('./graph.service');
const { filterAndMapUsers } = require('../utils/colaboradores.mapper');
const { env } = require('../config/env');

let syncEmAndamento = false;
let intervalHandle = null;

async function sincronizarColaboradores() {
  if (syncEmAndamento) {
    const err = new Error('Sincronização já em andamento.');
    err.status = 409;
    throw err;
  }

  syncEmAndamento = true;
  const inicio = Date.now();
  const resumo = { tenants: [], total: 0, erros: [] };

  try {
    const tenants = (await tenantsRepo.findAll()).filter(
      (t) => t.ativo && t.client_secret_ciphertext
    );
    const dominioMap = await empresaDominiosRepo.loadActiveMap();

    for (const tenant of tenants) {
      const tenantResumo = {
        tenant: tenant.nome,
        tenant_id: tenant.id,
        sincronizados: 0,
        inativados: 0,
        ignorados: 0,
      };

      try {
        const users = await graphService.listAllUsers(tenant);
        const { mapped, ignorados } = filterAndMapUsers(users, tenant, dominioMap);
        tenantResumo.ignorados = ignorados;

        if (mapped.length) {
          tenantResumo.sincronizados = await colaboradoresRepo.upsertBatch(mapped);
        }

        const adIds = mapped.map((m) => m.ad_id);
        tenantResumo.inativados = await colaboradoresRepo.markInactiveByTenant(tenant.id, adIds);
        resumo.total += tenantResumo.sincronizados;
      } catch (err) {
        tenantResumo.erro = err.message;
        resumo.erros.push({ tenant: tenant.nome, mensagem: err.message });
        console.error(`[colaboradores.sync] Falha no tenant ${tenant.nome}:`, err.message);
      }

      resumo.tenants.push(tenantResumo);
    }

    resumo.duracao_ms = Date.now() - inicio;
    resumo.sincronizado_em = await colaboradoresRepo.getUltimaSincronizacao();
    console.log(
      `[colaboradores.sync] Concluído: ${resumo.total} upserts em ${resumo.duracao_ms}ms` +
        (resumo.erros.length ? ` (${resumo.erros.length} tenant(s) com erro)` : '')
    );
    return resumo;
  } finally {
    syncEmAndamento = false;
  }
}

function agendarSincronizacaoColaboradores() {
  const intervalMs = env.syncColaboradoresMin * 60 * 1000;

  setTimeout(() => {
    sincronizarColaboradores().catch((err) => {
      if (err.status !== 409) {
        console.error('[colaboradores.sync] Erro na sync inicial:', err.message);
      }
    });
  }, 5000);

  if (intervalHandle) {
    clearInterval(intervalHandle);
  }

  intervalHandle = setInterval(() => {
    sincronizarColaboradores().catch((err) => {
      if (err.status !== 409) {
        console.error('[colaboradores.sync] Erro na sync agendada:', err.message);
      }
    });
  }, intervalMs);

  console.log(
    `[colaboradores.sync] Agendado a cada ${env.syncColaboradoresMin} min (primeira execução em 5s)`
  );
}

function isSyncEmAndamento() {
  return syncEmAndamento;
}

module.exports = {
  sincronizarColaboradores,
  agendarSincronizacaoColaboradores,
  isSyncEmAndamento,
};
