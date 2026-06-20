const { getPool } = require('../db/pool');

const SMTP_CONFIG_ID = 1;

function mapSmtpConfigPublic(row) {
  if (!row) return null;
  return {
    host: row.host || '',
    port: row.port ?? 587,
    secure: !!row.secure,
    user: row.user || '',
    has_password: Boolean(row.password_ciphertext),
    from_email: row.from_email || '',
    from_name: row.from_name || '',
    ativo: !!row.ativo,
    atualizado_em: row.atualizado_em,
  };
}

function mapSmtpConfigInternal(row) {
  if (!row) return null;
  return {
    ...mapSmtpConfigPublic(row),
    password_ciphertext: row.password_ciphertext,
  };
}

async function get() {
  const pool = getPool();
  const [rows] = await pool.execute('SELECT * FROM smtp_config WHERE id = ? LIMIT 1', [
    SMTP_CONFIG_ID,
  ]);
  return mapSmtpConfigInternal(rows[0]);
}

async function upsert(data) {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO smtp_config (
      id, host, port, secure, user, password_ciphertext, from_email, from_name, ativo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      host = VALUES(host),
      port = VALUES(port),
      secure = VALUES(secure),
      user = VALUES(user),
      password_ciphertext = COALESCE(VALUES(password_ciphertext), password_ciphertext),
      from_email = VALUES(from_email),
      from_name = VALUES(from_name),
      ativo = VALUES(ativo),
      atualizado_em = CURRENT_TIMESTAMP`,
    [
      SMTP_CONFIG_ID,
      data.host ?? '',
      data.port ?? 587,
      data.secure ? 1 : 0,
      data.user ?? '',
      data.password_ciphertext ?? null,
      data.from_email ?? '',
      data.from_name ?? null,
      data.ativo ? 1 : 0,
    ]
  );
  return get();
}

module.exports = {
  SMTP_CONFIG_ID,
  mapSmtpConfigPublic,
  mapSmtpConfigInternal,
  get,
  upsert,
};
