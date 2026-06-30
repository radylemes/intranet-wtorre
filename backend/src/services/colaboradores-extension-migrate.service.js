const tenantsRepo = require('../repositories/tenants.repository');
const graphService = require('./graph.service');
const syncService = require('./colaboradores.sync');
const { ensureRegistered, updateUserExtensionWithRetry } = require('./colaboradores-schema-extension.service');
const {
  extractDirectoryExtension,
  extractOnPremLegacy,
  buildExtensionPatch,
} = require('../utils/colaboradores.directory-extension');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function migrateExtensionAttributes({ dryRun = false } = {}) {
  const tenants = (await tenantsRepo.findAll()).filter(
    (t) => t.ativo && t.client_secret_ciphertext
  );

  const erros = [];
  let migrados = 0;
  let ignorados = 0;

  const registeredClientIds = new Set();
  for (const tenant of tenants) {
    const clientId = tenant.client_id;
    if (!clientId || registeredClientIds.has(clientId)) continue;
    try {
      await ensureRegistered(tenant);
      registeredClientIds.add(clientId);
    } catch (err) {
      erros.push({
        tenant: tenant.nome,
        ad_id: null,
        email: null,
        mensagem: err.message || 'Erro ao registrar schema extension.',
        operacao: err.operation || 'ensureRegistered',
      });
    }
  }

  for (const tenant of tenants) {
    if (!registeredClientIds.has(tenant.client_id)) continue;

    try {
      const users = await graphService.listAllUsers(tenant);

      for (const user of users) {
        const ext = extractDirectoryExtension(user, tenant.client_id);
        const legacy = extractOnPremLegacy(user);
        const patchPayload = {};

        if (!ext.ramal && legacy.extensionAttribute5) {
          patchPayload.ramal = legacy.extensionAttribute5;
        }
        if (!ext.dataNascimento && legacy.extensionAttribute6) {
          patchPayload.dataNascimento = legacy.extensionAttribute6;
        }

        if (!Object.keys(patchPayload).length) {
          ignorados += 1;
          continue;
        }

        if (dryRun) {
          migrados += 1;
          continue;
        }

        try {
          const patch = buildExtensionPatch(tenant.client_id, patchPayload);
          await updateUserExtensionWithRetry(tenant, user.id, patch);
          migrados += 1;
          await sleep(150);
        } catch (err) {
          erros.push({
            tenant: tenant.nome,
            ad_id: user.id,
            email: user.mail || user.userPrincipalName || null,
            mensagem: err.message || 'Erro ao migrar extension attributes.',
          });
        }
      }
    } catch (err) {
      erros.push({
        tenant: tenant.nome,
        ad_id: null,
        email: null,
        mensagem: err.message || 'Erro no tenant.',
      });
    }
  }

  let sync = null;
  if (!dryRun && migrados > 0) {
    try {
      sync = await syncService.sincronizarColaboradores();
    } catch (err) {
      erros.push({
        tenant: null,
        ad_id: null,
        email: null,
        mensagem: `Migração aplicada, mas sync falhou: ${err.message}`,
      });
    }
  }

  return { migrados, ignorados, erros, dry_run: dryRun, sync };
}

module.exports = { migrateExtensionAttributes };
