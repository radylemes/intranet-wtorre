const { getPool } = require('../db/pool');

function mapDocumento(row) {
  if (!row) return null;
  return {
    id: row.id,
    categoria_id: row.categoria_id,
    titulo: row.titulo,
    descricao: row.descricao,
    nome_original: row.nome_original,
    arquivo_path: row.arquivo_path,
    mime: row.mime,
    extensao: row.extensao,
    tamanho_bytes: Number(row.tamanho_bytes),
    criado_por: row.criado_por,
    ativo: !!row.ativo,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em,
  };
}

async function resolveCategoriaId(categoriaRef) {
  if (categoriaRef == null || categoriaRef === '') return null;
  const asNum = Number(categoriaRef);
  if (!Number.isNaN(asNum) && String(asNum) === String(categoriaRef).trim()) {
    return asNum;
  }
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT id FROM categorias_documentos WHERE slug = ? LIMIT 1',
    [categoriaRef]
  );
  return rows[0]?.id ?? null;
}

async function findByCategoria(categoriaId, { ativoOnly = true } = {}) {
  const pool = getPool();
  const sql = ativoOnly
    ? 'SELECT * FROM documentos WHERE categoria_id = ? AND ativo = 1 ORDER BY criado_em DESC'
    : 'SELECT * FROM documentos WHERE categoria_id = ? ORDER BY criado_em DESC';
  const [rows] = await pool.execute(sql, [categoriaId]);
  return rows.map(mapDocumento);
}

async function findById(id) {
  const pool = getPool();
  const [rows] = await pool.execute('SELECT * FROM documentos WHERE id = ? LIMIT 1', [id]);
  return mapDocumento(rows[0]);
}

async function create(data) {
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO documentos (categoria_id, titulo, descricao, nome_original, arquivo_path, mime, extensao, tamanho_bytes, criado_por, ativo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.categoria_id,
      data.titulo,
      data.descricao ?? null,
      data.nome_original,
      data.arquivo_path,
      data.mime,
      data.extensao,
      data.tamanho_bytes,
      data.criado_por ?? null,
      data.ativo !== false ? 1 : 0,
    ]
  );
  return findById(result.insertId);
}

async function update(id, data) {
  const pool = getPool();
  const fields = [];
  const values = [];
  const allowed = ['categoria_id', 'titulo', 'descricao', 'ativo'];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      if (key === 'ativo') {
        values.push(data[key] ? 1 : 0);
      } else {
        values.push(data[key]);
      }
    }
  }

  if (fields.length) {
    values.push(id);
    await pool.execute(`UPDATE documentos SET ${fields.join(', ')} WHERE id = ?`, values);
  }
  return findById(id);
}

async function remove(id) {
  const pool = getPool();
  await pool.execute('DELETE FROM documentos WHERE id = ?', [id]);
}

module.exports = {
  mapDocumento,
  resolveCategoriaId,
  findByCategoria,
  findById,
  create,
  update,
  remove,
};
