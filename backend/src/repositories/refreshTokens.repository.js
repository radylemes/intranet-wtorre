const crypto = require('crypto');
const { getPool } = require('../db/pool');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function create(userId, token, expiresAt, deviceInfo = null) {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO refresh_tokens (user_id, token_hash, client_type, device_info, expires_at)
     VALUES (?, ?, 'web', ?, ?)`,
    [userId, hashToken(token), deviceInfo, expiresAt]
  );
}

async function findValid(token) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1`,
    [hashToken(token)]
  );
  return rows[0] || null;
}

async function revoke(token) {
  const pool = getPool();
  await pool.execute(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL',
    [hashToken(token)]
  );
}

async function revokeAllForUser(userId) {
  const pool = getPool();
  await pool.execute(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
    [userId]
  );
}

module.exports = { create, findValid, revoke, revokeAllForUser, hashToken };
