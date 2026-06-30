const { getPool } = require('../db/pool');

async function logEmbedToken({ userId, email, reportId, setorId }) {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO powerbi_access_log (user_id, email, report_id, setor_id, acao)
     VALUES (?, ?, ?, ?, 'EMBED_TOKEN')`,
    [userId || null, email || null, reportId || null, setorId ?? null]
  );
}

async function logSetorNaoResolvido({ userId, email, departamento }) {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO powerbi_access_log (user_id, email, departamento, acao)
     VALUES (?, ?, ?, 'SETOR_NAO_RESOLVIDO')`,
    [userId || null, email || null, departamento || null]
  );
}

module.exports = {
  logEmbedToken,
  logSetorNaoResolvido,
};
