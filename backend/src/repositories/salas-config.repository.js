const { getPool } = require('../db/pool');
const { normalizeUiConfig } = require('../services/salas-ui-config.resolver');

const SALAS_CONFIG_ID = 1;

function parseLocalidades(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseUiConfigJson(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
}

function mapSalasConfigPublic(row) {
  if (!row) return null;
  return {
    ativo: !!row.ativo,
    api_base_url: row.api_base_url || '',
    localidade_padrao: row.localidade_padrao || 'wtorre',
    localidades: parseLocalidades(row.localidades_json),
    atualizado_em: row.atualizado_em,
  };
}

function mapSalasConfigInternal(row) {
  if (!row) return null;
  const uiConfigRaw = parseUiConfigJson(row.ui_config_json);
  return {
    ...mapSalasConfigPublic(row),
    admin_api_key_ciphertext: row.admin_api_key_ciphertext,
    ui_config_json: uiConfigRaw ? normalizeUiConfig(uiConfigRaw) : null,
    localidades: parseLocalidades(row.localidades_json),
  };
}

async function get() {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT * FROM salas_config WHERE id = ? LIMIT 1',
    [SALAS_CONFIG_ID]
  );
  return mapSalasConfigInternal(rows[0]);
}

async function upsert(data) {
  const pool = getPool();
  const localidadesJson = JSON.stringify(data.localidades || []);
  const hasUiConfig = data.ui_config_json != null;
  const uiConfigJson = hasUiConfig
    ? JSON.stringify(normalizeUiConfig(data.ui_config_json))
    : null;

  if (hasUiConfig) {
    await pool.execute(
      `INSERT INTO salas_config (
        id, ativo, api_base_url, localidade_padrao, localidades_json,
        admin_api_key_ciphertext, admin_api_key_hint, ui_config_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON))
      ON DUPLICATE KEY UPDATE
        ativo = VALUES(ativo),
        api_base_url = VALUES(api_base_url),
        localidade_padrao = VALUES(localidade_padrao),
        localidades_json = VALUES(localidades_json),
        admin_api_key_ciphertext = COALESCE(VALUES(admin_api_key_ciphertext), admin_api_key_ciphertext),
        admin_api_key_hint = COALESCE(VALUES(admin_api_key_hint), admin_api_key_hint),
        ui_config_json = VALUES(ui_config_json),
        atualizado_em = CURRENT_TIMESTAMP`,
      [
        SALAS_CONFIG_ID,
        data.ativo ? 1 : 0,
        data.api_base_url ?? '',
        data.localidade_padrao ?? 'wtorre',
        localidadesJson,
        data.admin_api_key_ciphertext ?? null,
        data.admin_api_key_hint ?? null,
        uiConfigJson,
      ]
    );
  } else {
    await pool.execute(
      `INSERT INTO salas_config (
        id, ativo, api_base_url, localidade_padrao, localidades_json,
        admin_api_key_ciphertext, admin_api_key_hint
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        ativo = VALUES(ativo),
        api_base_url = VALUES(api_base_url),
        localidade_padrao = VALUES(localidade_padrao),
        localidades_json = VALUES(localidades_json),
        admin_api_key_ciphertext = COALESCE(VALUES(admin_api_key_ciphertext), admin_api_key_ciphertext),
        admin_api_key_hint = COALESCE(VALUES(admin_api_key_hint), admin_api_key_hint),
        atualizado_em = CURRENT_TIMESTAMP`,
      [
        SALAS_CONFIG_ID,
        data.ativo ? 1 : 0,
        data.api_base_url ?? '',
        data.localidade_padrao ?? 'wtorre',
        localidadesJson,
        data.admin_api_key_ciphertext ?? null,
        data.admin_api_key_hint ?? null,
      ]
    );
  }
  return get();
}

module.exports = {
  SALAS_CONFIG_ID,
  mapSalasConfigPublic,
  mapSalasConfigInternal,
  parseLocalidades,
  get,
  upsert,
};
