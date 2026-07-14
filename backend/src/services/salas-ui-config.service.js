const salasConfigRepo = require('../repositories/salas-config.repository');
const salasConfigService = require('./salas-config.service');
const salasExternalSync = require('./salas-external-sync.service');
const {
  normalizeUiConfig,
  buildPublicTabs,
  extractApiLocalidades,
  validateUiConfigForSave,
} = require('./salas-ui-config.resolver');

async function loadNormalizedConfig() {
  const row = await salasConfigRepo.get();
  const raw = row?.ui_config_json;
  if (!raw || (typeof raw === 'object' && !Object.keys(raw).length)) {
    return normalizeUiConfig(null);
  }
  if (typeof raw === 'string') {
    try {
      return normalizeUiConfig(JSON.parse(raw));
    } catch {
      return normalizeUiConfig(null);
    }
  }
  return normalizeUiConfig(raw);
}

async function saveNormalizedConfig(config) {
  const normalized = validateUiConfigForSave(config);
  const existing = await salasConfigRepo.get();
  await salasConfigRepo.upsert({
    ativo: existing?.ativo ? 1 : 0,
    api_base_url: existing?.api_base_url || '',
    localidade_padrao: existing?.localidade_padrao || 'wtorre',
    localidades: existing?.localidades || [],
    admin_api_key_ciphertext: existing?.admin_api_key_ciphertext ?? null,
    admin_api_key_hint: existing?.admin_api_key_hint ?? null,
    ui_config_json: normalized,
  });
  await salasExternalSync.syncAll(normalized);
  require('./salas.service').invalidarCache();
  return normalized;
}

async function getAdminUiConfig() {
  const config = await loadNormalizedConfig();
  return { config };
}

async function saveAdminUiConfig(body) {
  const config = await saveNormalizedConfig(body?.config ?? body);
  return { config };
}

async function getPublicUiConfig() {
  const connection = await salasConfigService.getInternalConfig({ requireActive: true });
  const config = await loadNormalizedConfig();

  if (!config.tabs?.length) {
    const err = new Error('Configuração de abas indisponível.');
    err.status = 502;
    throw err;
  }

  const tabs = buildPublicTabs(config);
  const defaultTab =
    tabs.find((t) => t.id === connection.localidade_padrao) || tabs[0];

  return {
    tabs,
    domainToApiLocalidade: config.domainToApiLocalidade || {},
    roomTabOverrides: config.roomTabOverrides || {},
    roomOrderByTab: config.roomOrderByTab || {},
    roomDisplayNames: config.roomDisplayNames || {},
    localidadePadrao: defaultTab?.id || tabs[0]?.id,
    apiLocalidades: extractApiLocalidades(config),
  };
}

async function getAllowedLocalidades() {
  const config = await loadNormalizedConfig();
  const allowed = extractApiLocalidades(config);
  if (!allowed.length) {
    allowed.push('WTorre', 'Allianz');
  }
  return allowed;
}

module.exports = {
  loadNormalizedConfig,
  saveNormalizedConfig,
  getAdminUiConfig,
  saveAdminUiConfig,
  getPublicUiConfig,
  getAllowedLocalidades,
};
