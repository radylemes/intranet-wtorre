const { getPool } = require('../db/pool');

async function getDepartamentoColaborador(adId) {
  if (!adId) return null;
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT departamento FROM colaboradores
     WHERE ad_id = ? AND ativo = 1 AND departamento IS NOT NULL AND departamento != ''
     LIMIT 1`,
    [adId]
  );
  const dept = rows[0]?.departamento;
  return dept ? String(dept).trim() : null;
}

async function updateSetorId(userId, setorId) {
  const pool = getPool();
  await pool.execute('UPDATE usuarios SET setor_id = ?, atualizado_em = NOW() WHERE id = ?', [
    setorId,
    userId,
  ]);
}

module.exports = {
  getDepartamentoColaborador,
  updateSetorId,
};
