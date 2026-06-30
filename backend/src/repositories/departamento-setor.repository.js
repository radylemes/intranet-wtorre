const { getPool } = require('../db/pool');

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    departamento: row.departamento,
    setor_id: row.setor_id,
    ativo: !!row.ativo,
  };
}

async function findByDepartamento(departamento) {
  const value = String(departamento || '').trim();
  if (!value) return null;
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT id, departamento, setor_id, ativo FROM departamento_setor WHERE departamento = ? AND ativo = 1 LIMIT 1',
    [value]
  );
  return mapRow(rows[0]);
}

async function listAll() {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT id, departamento, setor_id, ativo FROM departamento_setor ORDER BY departamento ASC'
  );
  return rows.map(mapRow);
}

module.exports = {
  findByDepartamento,
  listAll,
};
