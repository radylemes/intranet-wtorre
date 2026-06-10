const { getPool } = require('../db/pool');

async function log({ userId, action, provider, email, requestId, ip }) {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO audit_log (user_id, action, provider, email, request_id, ip)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId || null, action, provider || null, email || null, requestId || null, ip || null]
  );
}

module.exports = { log };
