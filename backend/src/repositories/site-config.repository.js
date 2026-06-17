const { getPool } = require('../db/pool');

const HEADER_KEYS = {
  label: 'header.chamado.label',
  url: 'header.chamado.url',
  ativo: 'header.chamado.ativo',
  novaAba: 'header.chamado.nova_aba',
};

async function get(chave) {
  const pool = getPool();
  const [rows] = await pool.execute('SELECT valor FROM site_config WHERE chave = ? LIMIT 1', [
    chave,
  ]);
  return rows[0]?.valor ?? null;
}

async function getMany(chaves) {
  if (!chaves.length) return {};
  const pool = getPool();
  const placeholders = chaves.map(() => '?').join(', ');
  const [rows] = await pool.execute(
    `SELECT chave, valor FROM site_config WHERE chave IN (${placeholders})`,
    chaves
  );
  const map = {};
  for (const row of rows) {
    map[row.chave] = row.valor;
  }
  return map;
}

async function set(chave, valor) {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO site_config (chave, valor) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor), atualizado_em = CURRENT_TIMESTAMP`,
    [chave, valor]
  );
}

async function getHeaderChamado() {
  const vals = await getMany(Object.values(HEADER_KEYS));
  const url = vals[HEADER_KEYS.url] || null;
  const isExterna = url && /^https?:\/\//i.test(url);

  return {
    label: vals[HEADER_KEYS.label] || 'Abrir Chamado',
    url,
    ativo: vals[HEADER_KEYS.ativo] === '1',
    abrir_nova_aba: vals[HEADER_KEYS.novaAba] !== '0',
    tipo_destino: url ? (isExterna ? 'externa' : 'interna') : 'interna',
  };
}

async function setHeaderChamado({ label, url, ativo, abrir_nova_aba }) {
  await set(HEADER_KEYS.label, label || 'Abrir Chamado');
  await set(HEADER_KEYS.url, url || null);
  await set(HEADER_KEYS.ativo, ativo ? '1' : '0');
  await set(HEADER_KEYS.novaAba, abrir_nova_aba ? '1' : '0');
  return getHeaderChamado();
}

module.exports = {
  HEADER_KEYS,
  get,
  getMany,
  set,
  getHeaderChamado,
  setHeaderChamado,
};
