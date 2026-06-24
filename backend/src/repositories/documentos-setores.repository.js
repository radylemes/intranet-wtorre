const { getPool } = require('../db/pool');

function mapSetor(row) {
  if (!row) return null;
  return {
    id: row.id,
    nome: row.nome,
    slug: row.slug,
    cor: row.cor,
    ordem: row.ordem,
    ativo: !!row.ativo,
    criado_em: row.criado_em,
  };
}

async function findAll({ ativoOnly = false } = {}) {
  const pool = getPool();
  const sql = ativoOnly
    ? 'SELECT * FROM documentos_setores WHERE ativo = 1 ORDER BY ordem, id'
    : 'SELECT * FROM documentos_setores ORDER BY ordem, id';
  const [rows] = await pool.execute(sql);
  return rows.map(mapSetor);
}

async function findById(id) {
  const pool = getPool();
  const [rows] = await pool.execute('SELECT * FROM documentos_setores WHERE id = ? LIMIT 1', [id]);
  return mapSetor(rows[0]);
}

async function findBySlug(slug) {
  const pool = getPool();
  const [rows] = await pool.execute('SELECT * FROM documentos_setores WHERE slug = ? LIMIT 1', [slug]);
  return mapSetor(rows[0]);
}

async function create(data) {
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO documentos_setores (nome, slug, cor, ordem, ativo)
     VALUES (?, ?, ?, ?, ?)`,
    [data.nome, data.slug, data.cor ?? null, data.ordem ?? 0, data.ativo !== false ? 1 : 0]
  );
  return findById(result.insertId);
}

async function update(id, data) {
  const pool = getPool();
  const fields = [];
  const values = [];
  const allowed = ['nome', 'slug', 'cor', 'ordem', 'ativo'];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(key === 'ativo' ? (data[key] ? 1 : 0) : data[key]);
    }
  }

  if (fields.length) {
    values.push(id);
    await pool.execute(`UPDATE documentos_setores SET ${fields.join(', ')} WHERE id = ?`, values);
  }
  return findById(id);
}

async function remove(id) {
  const pool = getPool();
  await pool.execute('DELETE FROM documentos_setores WHERE id = ?', [id]);
}

module.exports = {
  mapSetor,
  findAll,
  findById,
  findBySlug,
  create,
  update,
  remove,
};
