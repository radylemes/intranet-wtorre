const { getPool } = require('../db/pool');

const SNAPSHOT_ID = 1;

function parseJson(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function mapSnapshot(row) {
  if (!row) return null;
  return {
    id: row.id,
    payload_eventos: parseJson(row.payload_eventos),
    payload_usuarios: parseJson(row.payload_usuarios),
    gerado_em_eventos: row.gerado_em_eventos || null,
    gerado_em_usuarios: row.gerado_em_usuarios || null,
    sincronizado_em: row.sincronizado_em || null,
    status: row.status || 'ok',
    ultimo_erro: row.ultimo_erro || null,
  };
}

async function getSnapshot() {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT * FROM bid_sync_snapshot WHERE id = ? LIMIT 1',
    [SNAPSHOT_ID]
  );
  return mapSnapshot(rows[0]);
}

async function saveSnapshot({
  payloadEventos,
  payloadUsuarios,
  geradoEmEventos,
  geradoEmUsuarios,
  status = 'ok',
  ultimoErro = null,
}) {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO bid_sync_snapshot (
      id, payload_eventos, payload_usuarios, gerado_em_eventos, gerado_em_usuarios,
      sincronizado_em, status, ultimo_erro
    ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
    ON DUPLICATE KEY UPDATE
      payload_eventos = VALUES(payload_eventos),
      payload_usuarios = VALUES(payload_usuarios),
      gerado_em_eventos = VALUES(gerado_em_eventos),
      gerado_em_usuarios = VALUES(gerado_em_usuarios),
      sincronizado_em = CURRENT_TIMESTAMP,
      status = VALUES(status),
      ultimo_erro = VALUES(ultimo_erro)`,
    [
      SNAPSHOT_ID,
      payloadEventos != null ? JSON.stringify(payloadEventos) : null,
      payloadUsuarios != null ? JSON.stringify(payloadUsuarios) : null,
      geradoEmEventos || null,
      geradoEmUsuarios || null,
      status,
      ultimoErro,
    ]
  );
  return getSnapshot();
}

async function markSnapshotErro(mensagem) {
  const pool = getPool();
  await pool.execute(
    `UPDATE bid_sync_snapshot
     SET status = 'erro', ultimo_erro = ?, sincronizado_em = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [mensagem, SNAPSHOT_ID]
  );
}

async function touchUltimaSync({ erro = null } = {}) {
  const pool = getPool();
  await pool.execute(
    `UPDATE bid_integracao_config
     SET ultima_sync = CURRENT_TIMESTAMP, ultima_sync_erro = ?
     WHERE id = 1`,
    [erro]
  );
}

module.exports = {
  SNAPSHOT_ID,
  getSnapshot,
  saveSnapshot,
  markSnapshotErro,
  touchUltimaSync,
};
