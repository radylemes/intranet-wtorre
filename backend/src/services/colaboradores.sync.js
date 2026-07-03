const tenantsRepo = require('../repositories/tenants.repository');
const colaboradoresRepo = require('../repositories/colaboradores.repository');
const empresaDominiosRepo = require('../repositories/empresa-dominios.repository');
const usersRepo = require('../repositories/users.repository');
const departamentoSetorRepo = require('../repositories/departamento-setor.repository');
const setorUsuarioRepo = require('../repositories/setor-usuario.repository');
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
  const resumo = { tenants: [], total: 0, erros: [], departamentos_sem_mapa: [] };

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
        const token = await graphService.getAppToken(tenant);
        const users = await graphService.listAllUsers(tenant);
        const candidatos = users
          .filter((user) => {
            if (!user?.id || user.accountEnabled !== true || user.userType === 'Guest') return false;
            const nome = user.displayName && String(user.displayName).trim();
            const mail = user.mail && String(user.mail).trim();
            const upn = user.userPrincipalName && String(user.userPrincipalName).trim();
            const dept = user.department && String(user.department).trim();
            return !!(nome && dept && (mail || upn));
          })
          .map((user) => user.id);

        const { purposes, disponivel } = await graphService.fetchMailboxUserPurposes(
          token,
          candidatos
        );
        tenantResumo.mailbox_purpose_disponivel = disponivel;
        if (!disponivel) {
          tenantResumo.aviso =
            'Permissão MailboxSettings.Read ausente no tenant. Sync usando apenas heurística de nome/matrícula.';
          console.warn(
            `[colaboradores.sync] Tenant ${tenant.nome}: MailboxSettings.Read ausente; fallback heurístico.`
          );
        }

        const { mapped, ignorados } = filterAndMapUsers(users, tenant, dominioMap, {
          mailboxPurposes: purposes,
        });
        tenantResumo.ignorados = ignorados;

        if (mapped.length) {
          tenantResumo.sincronizados = await colaboradoresRepo.upsertBatch(mapped);
          const { atualizados, semMapa } = await propagarSetorIdUsuarios(mapped);
          tenantResumo.usuarios_setor_atualizados = atualizados;
          for (const dept of semMapa) {
            if (!resumo.departamentos_sem_mapa.includes(dept)) {
              resumo.departamentos_sem_mapa.push(dept);
            }
          }
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

async function propagarSetorIdUsuarios(mapped) {
  let atualizados = 0;
  const semMapa = [];

  for (const row of mapped) {
    const adId = row.ad_id;
    const departamento = row.departamento ? String(row.departamento).trim() : '';
    if (!adId || !departamento) continue;

    const mapa = await departamentoSetorRepo.findByDepartamento(departamento);
    if (!mapa?.setor_id) {
      if (!semMapa.includes(departamento)) semMapa.push(departamento);
      continue;
    }

    const user = await usersRepo.findByMicrosoftId(adId);
    if (!user) continue;

    if (user.setor_id !== mapa.setor_id) {
      await setorUsuarioRepo.updateSetorId(user.id, mapa.setor_id);
      atualizados += 1;
    }
  }

  return { atualizados, semMapa };
}

module.exports = {
  sincronizarColaboradores,
  agendarSincronizacaoColaboradores,
  isSyncEmAndamento,
};
