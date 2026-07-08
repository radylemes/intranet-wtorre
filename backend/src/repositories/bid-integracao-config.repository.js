const { getPool } = require('../db/pool');

const BID_CONFIG_ID = 1;

function mapBidIntegracaoConfigPublic(row) {
  if (!row) return null;
  return {
    ativo: !!row.ativo,
    api_base_url: row.api_base_url || '',
    has_api_key: Boolean(row.api_key_ciphertext),
    api_key_hint: row.api_key_hint || null,
    app_url: row.app_url || 'https://bid.nubankparque.com',
    cache_ttl_min: row.cache_ttl_min ?? 3,
    sync_automatica: row.sync_automatica != null ? !!row.sync_automatica : true,
    sync_intervalo_min: row.sync_intervalo_min ?? 15,
    ultima_sync: row.ultima_sync ?? null,
    ultima_sync_erro: row.ultima_sync_erro ?? null,
    atualizado_em: row.atualizado_em,
  };
}

function mapBidIntegracaoConfigInternal(row) {
  if (!row) return null;
  return {
    ...mapBidIntegracaoConfigPublic(row),
    api_key_ciphertext: row.api_key_ciphertext,
  };
}

async function get() {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT * FROM bid_integracao_config WHERE id = ? LIMIT 1',
    [BID_CONFIG_ID]
  );
  return mapBidIntegracaoConfigInternal(rows[0]);
}

async function upsert(data) {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO bid_integracao_config (
      id, ativo, api_base_url, api_key_ciphertext, api_key_hint, app_url, cache_ttl_min,
      sync_automatica, sync_intervalo_min
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      ativo = VALUES(ativo),
      api_base_url = VALUES(api_base_url),
      api_key_ciphertext = COALESCE(VALUES(api_key_ciphertext), api_key_ciphertext),
      api_key_hint = COALESCE(VALUES(api_key_hint), api_key_hint),
      app_url = VALUES(app_url),
      cache_ttl_min = VALUES(cache_ttl_min),
      sync_automatica = VALUES(sync_automatica),
      sync_intervalo_min = VALUES(sync_intervalo_min),
      atualizado_em = CURRENT_TIMESTAMP`,
    [
      BID_CONFIG_ID,
      data.ativo ? 1 : 0,
      data.api_base_url ?? '',
      data.api_key_ciphertext ?? null,
      data.api_key_hint ?? null,
      data.app_url ?? 'https://bid.nubankparque.com',
      data.cache_ttl_min ?? 3,
      data.sync_automatica != null ? (data.sync_automatica ? 1 : 0) : 1,
      data.sync_intervalo_min ?? 15,
    ]
  );
  return get();
}

module.exports = {
  BID_CONFIG_ID,
  mapBidIntegracaoConfigPublic,
  mapBidIntegracaoConfigInternal,
  get,
  upsert,
};
