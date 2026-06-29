const { getPool } = require('../db/pool');

function mapPagina(row) {
  if (!row) return null;
  return {
    id: row.id,
    nome: row.nome,
    slug: row.slug,
    descricao: row.descricao,
    logo_url: row.logo_url,
    ordem: row.ordem,
    ativo: !!row.ativo,
    exibir_menu_treinamento: !!row.exibir_menu_treinamento,
    criado_em: row.criado_em,
  };
}

async function findAll({ ativoOnly = false } = {}) {
  const pool = getPool();
  const sql = ativoOnly
    ? 'SELECT * FROM documentos_paginas WHERE ativo = 1 ORDER BY ordem, id'
    : 'SELECT * FROM documentos_paginas ORDER BY ordem, id';
  const [rows] = await pool.execute(sql);
  return rows.map(mapPagina);
}

async function findById(id) {
  const pool = getPool();
  const [rows] = await pool.execute('SELECT * FROM documentos_paginas WHERE id = ? LIMIT 1', [id]);
  return mapPagina(rows[0]);
}

async function findBySlug(slug) {
  const pool = getPool();
  const [rows] = await pool.execute('SELECT * FROM documentos_paginas WHERE slug = ? LIMIT 1', [slug]);
  return mapPagina(rows[0]);
}

async function create(data) {
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO documentos_paginas (nome, slug, descricao, logo_url, ordem, ativo, exibir_menu_treinamento)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.nome,
      data.slug,
      data.descricao ?? null,
      data.logo_url ?? null,
      data.ordem ?? 0,
      data.ativo !== false ? 1 : 0,
      data.exibir_menu_treinamento ? 1 : 0,
    ]
  );
  return findById(result.insertId);
}

async function update(id, data) {
  const pool = getPool();
  const fields = [];
  const values = [];
  const allowed = ['nome', 'slug', 'descricao', 'logo_url', 'ordem', 'ativo', 'exibir_menu_treinamento'];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      if (key === 'ativo' || key === 'exibir_menu_treinamento') {
        values.push(data[key] ? 1 : 0);
      } else {
        values.push(data[key]);
      }
    }
  }

  if (fields.length) {
    values.push(id);
    await pool.execute(`UPDATE documentos_paginas SET ${fields.join(', ')} WHERE id = ?`, values);
  }
  return findById(id);
}

async function remove(id) {
  const pool = getPool();
  await pool.execute('DELETE FROM documentos_paginas WHERE id = ?', [id]);
}

module.exports = {
  mapPagina,
  findAll,
  findById,
  findBySlug,
  create,
  update,
  remove,
};
