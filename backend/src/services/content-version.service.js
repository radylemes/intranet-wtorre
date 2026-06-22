const { getPool } = require('../db/pool');

const RECURSOS = [
  'menu',
  'topbar',
  'rodape',
  'paginas',
  'documentos',
  'treinamentos',
  'configuracoes',
  'permissoes',
];

function chave(recurso) {
  return `content.version.${recurso}`;
}

async function bump(recurso) {
  if (!RECURSOS.includes(recurso)) return;
  const pool = getPool();
  await pool.execute(
    `INSERT INTO site_config (chave, valor) VALUES (?, '0')
     ON DUPLICATE KEY UPDATE valor = CAST(valor AS UNSIGNED) + 1`,
    [chave(recurso)]
  );
}

async function bumpMany(recursos) {
  for (const recurso of recursos) {
    await bump(recurso);
  }
}

async function getAll() {
  const pool = getPool();
  const keys = RECURSOS.map(chave);
  const placeholders = keys.map(() => '?').join(', ');
  const [rows] = await pool.execute(
    `SELECT chave, valor FROM site_config WHERE chave IN (${placeholders})`,
    keys
  );

  const result = {};
  for (const recurso of RECURSOS) {
    result[recurso] = 0;
  }
  for (const row of rows) {
    const recurso = row.chave.replace('content.version.', '');
    if (RECURSOS.includes(recurso)) {
      result[recurso] = Number(row.valor) || 0;
    }
  }
  return result;
}

module.exports = {
  RECURSOS,
  bump,
  bumpMany,
  getAll,
};
