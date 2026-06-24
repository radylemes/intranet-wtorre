const { getPool } = require('../db/pool');

function mapDocumento(row) {
  if (!row) return null;
  const doc = {
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
    setor_id: row.setor_id,
    ativo: !!row.ativo,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em,
  };
  if (row.setor_nome != null) {
    doc.setor = {
      id: row.setor_id,
      nome: row.setor_nome,
      slug: row.setor_slug,
      cor: row.setor_cor,
    };
  }
  return doc;
}

async function resolveCategoriaId(categoriaRef, paginaId = null) {
  if (categoriaRef == null || categoriaRef === '') return null;
  const asNum = Number(categoriaRef);
  if (!Number.isNaN(asNum) && String(asNum) === String(categoriaRef).trim()) {
    return asNum;
  }
  const pool = getPool();
  if (paginaId != null) {
    const [rows] = await pool.execute(
      'SELECT id FROM categorias_documentos WHERE slug = ? AND pagina_id = ? LIMIT 1',
      [categoriaRef, paginaId]
    );
    return rows[0]?.id ?? null;
  }
  const [rows] = await pool.execute(
    'SELECT id FROM categorias_documentos WHERE slug = ? LIMIT 1',
    [categoriaRef]
  );
  return rows[0]?.id ?? null;
}

async function resolveSetorFilter(setorRef) {
  if (setorRef == null || setorRef === '') return { type: 'all' };
  if (setorRef === 'sem-setor') return { type: 'none' };
  const asNum = Number(setorRef);
  if (!Number.isNaN(asNum) && String(asNum) === String(setorRef).trim()) {
    return { type: 'id', value: asNum };
  }
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT id FROM documentos_setores WHERE slug = ? LIMIT 1',
    [setorRef]
  );
  if (!rows[0]) return null;
  return { type: 'id', value: rows[0].id };
}

async function findByCategoria(categoriaId, { ativoOnly = true, setorFilter = { type: 'all' } } = {}) {
  const pool = getPool();
  const conditions = ['d.categoria_id = ?'];
  const params = [categoriaId];

  if (ativoOnly) {
    conditions.push('d.ativo = 1');
  }

  if (setorFilter.type === 'none') {
    conditions.push('d.setor_id IS NULL');
  } else if (setorFilter.type === 'id') {
    conditions.push('d.setor_id = ?');
    params.push(setorFilter.value);
  }

  const sql = `
    SELECT d.*, s.nome AS setor_nome, s.slug AS setor_slug, s.cor AS setor_cor
    FROM documentos d
    LEFT JOIN documentos_setores s ON d.setor_id = s.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY d.criado_em DESC`;

  const [rows] = await pool.execute(sql, params);
  return rows.map(mapDocumento);
}

async function findById(id) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT d.*, s.nome AS setor_nome, s.slug AS setor_slug, s.cor AS setor_cor
     FROM documentos d
     LEFT JOIN documentos_setores s ON d.setor_id = s.id
     WHERE d.id = ? LIMIT 1`,
    [id]
  );
  return mapDocumento(rows[0]);
}

async function create(data) {
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO documentos (categoria_id, titulo, descricao, nome_original, arquivo_path, mime, extensao, tamanho_bytes, criado_por, setor_id, ativo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      data.setor_id ?? null,
      data.ativo !== false ? 1 : 0,
    ]
  );
  return findById(result.insertId);
}

async function update(id, data) {
  const pool = getPool();
  const fields = [];
  const values = [];
  const allowed = ['categoria_id', 'titulo', 'descricao', 'setor_id', 'ativo'];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      if (key === 'ativo') {
        values.push(data[key] ? 1 : 0);
      } else if (key === 'setor_id' && (data[key] === '' || data[key] == null)) {
        values.push(null);
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
  resolveSetorFilter,
  findByCategoria,
  findById,
  create,
  update,
  remove,
};
