const { getPool } = require('../db/pool');

async function loadActiveMap() {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT dominio, empresa, classe FROM empresa_dominios WHERE ativo = 1'
  );
  const map = new Map();
  for (const row of rows) {
    map.set(String(row.dominio).toLowerCase().trim(), {
      empresa: row.empresa,
      classe: row.classe,
    });
  }
  return map;
}

module.exports = { loadActiveMap };
