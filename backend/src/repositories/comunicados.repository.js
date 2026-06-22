const { getPool } = require('../db/pool');

const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

const CATEGORIA_LABELS = {
  rh: 'Recursos Humanos',
  ti: 'Tecnologia',
  ev: 'Nubank Parque',
  com: 'Compliance',
};

function formatDataPublicacao(isoDate) {
  const raw = String(isoDate).slice(0, 10);
  const [year, month, day] = raw.split('-').map(Number);
  if (!year || !month || !day) {
    return { dia: '', mes: '', dataPublicacao: raw };
  }
  return {
    dia: String(day).padStart(2, '0'),
    mes: MESES[month - 1] || '',
    dataPublicacao: raw,
  };
}

function mapComunicado(row) {
  if (!row) return null;
  const dataFmt = formatDataPublicacao(row.data_publicacao);
  return {
    id: row.id,
    titulo: row.titulo,
    categoria: row.categoria,
    categoriaLabel: CATEGORIA_LABELS[row.categoria] || row.categoria,
    catClasse: row.categoria,
    dia: dataFmt.dia,
    mes: dataFmt.mes,
    dataPublicacao: dataFmt.dataPublicacao,
    ordem: row.ordem,
    ativo: Boolean(row.ativo),
    criado_por: row.criado_por,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em,
  };
}

async function listarPublicos(limite = 20) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM comunicados
     WHERE ativo = 1
     ORDER BY data_publicacao DESC, ordem IS NULL, ordem ASC, id DESC
     LIMIT ?`,
    [limite]
  );
  return rows.map(mapComunicado);
}

async function listarAdmin({ busca } = {}) {
  const pool = getPool();
  const conditions = [];
  const params = [];

  if (busca?.trim()) {
    conditions.push('titulo LIKE ?');
    params.push(`%${busca.trim()}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.execute(
    `SELECT * FROM comunicados ${where}
     ORDER BY data_publicacao DESC, ordem IS NULL, ordem ASC, id DESC`,
    params
  );
  return rows.map(mapComunicado);
}

async function buscarPorId(id) {
  const pool = getPool();
  const [rows] = await pool.execute('SELECT * FROM comunicados WHERE id = ? LIMIT 1', [id]);
  return mapComunicado(rows[0]);
}

async function criar(data) {
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO comunicados (titulo, categoria, data_publicacao, ordem, ativo, criado_por)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.titulo,
      data.categoria,
      data.data_publicacao,
      data.ordem ?? null,
      data.ativo ? 1 : 0,
      data.criado_por ?? null,
    ]
  );
  return buscarPorId(result.insertId);
}

async function atualizar(id, data) {
  const pool = getPool();
  await pool.execute(
    `UPDATE comunicados
     SET titulo = ?, categoria = ?, data_publicacao = ?, ordem = ?, ativo = ?
     WHERE id = ?`,
    [
      data.titulo,
      data.categoria,
      data.data_publicacao,
      data.ordem ?? null,
      data.ativo ? 1 : 0,
      id,
    ]
  );
  return buscarPorId(id);
}

async function remover(id) {
  const pool = getPool();
  await pool.execute('DELETE FROM comunicados WHERE id = ?', [id]);
}

module.exports = {
  CATEGORIA_LABELS,
  listarPublicos,
  listarAdmin,
  buscarPorId,
  criar,
  atualizar,
  remover,
};
