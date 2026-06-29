const { getPool } = require('../db/pool');

const EMAIL_PROVIDER_CONFIG_ID = 1;

function mapEmailProviderConfigPublic(row) {
  if (!row) return null;
  return {
    provider: row.provider === 'acs' ? 'acs' : 'smtp',
    has_acs_connection_string: Boolean(row.acs_connection_string_ciphertext),
    acs_sender: row.acs_sender || '',
    ocultar_para: !!row.ocultar_para,
    ativo: !!row.ativo,
    atualizado_em: row.atualizado_em,
  };
}

function mapEmailProviderConfigInternal(row) {
  if (!row) return null;
  return {
    ...mapEmailProviderConfigPublic(row),
    acs_connection_string_ciphertext: row.acs_connection_string_ciphertext,
  };
}

async function get() {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT * FROM email_provider_config WHERE id = ? LIMIT 1',
    [EMAIL_PROVIDER_CONFIG_ID]
  );
  return mapEmailProviderConfigInternal(rows[0]);
}

async function upsert(data) {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO email_provider_config (
      id, provider, acs_connection_string_ciphertext, acs_sender, ocultar_para, ativo
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      provider = VALUES(provider),
      acs_connection_string_ciphertext = COALESCE(
        VALUES(acs_connection_string_ciphertext),
        acs_connection_string_ciphertext
      ),
      acs_sender = VALUES(acs_sender),
      ocultar_para = VALUES(ocultar_para),
      ativo = VALUES(ativo),
      atualizado_em = CURRENT_TIMESTAMP`,
    [
      EMAIL_PROVIDER_CONFIG_ID,
      data.provider === 'acs' ? 'acs' : 'smtp',
      data.acs_connection_string_ciphertext ?? null,
      data.acs_sender ?? '',
      data.ocultar_para ? 1 : 0,
      data.ativo ? 1 : 0,
    ]
  );
  return get();
}

module.exports = {
  EMAIL_PROVIDER_CONFIG_ID,
  mapEmailProviderConfigPublic,
  mapEmailProviderConfigInternal,
  get,
  upsert,
};
