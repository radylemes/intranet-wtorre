const { getPool } = require('../db/pool');

function mapVisibilidade(row) {
  if (!row) return null;
  return {
    pagina_id: row.pagina_id,
    pagina_nome: row.pagina_nome ?? null,
    pagina_slug: row.pagina_slug ?? null,
    categoria_id: row.categoria_id ?? null,
    categoria_nome: row.categoria_nome ?? null,
    categoria_slug: row.categoria_slug ?? null,
  };
}

const SELECT_VIS = `
  SELECT de.documento_id, de.pagina_id, de.categoria_id,
         p.nome AS pagina_nome, p.slug AS pagina_slug,
         c.nome AS categoria_nome, c.slug AS categoria_slug
  FROM documento_entidades de
  INNER JOIN documentos_paginas p ON p.id = de.pagina_id
  LEFT JOIN categorias_documentos c ON c.id = de.categoria_id
`;

async function findByDocumentoId(documentoId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `${SELECT_VIS} WHERE de.documento_id = ? ORDER BY p.ordem ASC, p.nome ASC`,
    [documentoId]
  );
  return rows.map(mapVisibilidade);
}

async function findByDocumentoIds(documentoIds) {
  if (!documentoIds?.length) return new Map();
  const pool = getPool();
  const placeholders = documentoIds.map(() => '?').join(',');
  const [rows] = await pool.execute(
    `${SELECT_VIS} WHERE de.documento_id IN (${placeholders}) ORDER BY p.ordem ASC, p.nome ASC`,
    documentoIds
  );
  const map = new Map();
  for (const row of rows) {
    const list = map.get(row.documento_id) ?? [];
    list.push(mapVisibilidade(row));
    map.set(row.documento_id, list);
  }
  return map;
}

async function replaceForDocumento(documentoId, visibilidades) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM documento_entidades WHERE documento_id = ?', [documentoId]);
    for (const v of visibilidades) {
      await conn.execute(
        `INSERT INTO documento_entidades (documento_id, pagina_id, categoria_id)
         VALUES (?, ?, ?)`,
        [documentoId, v.pagina_id, v.categoria_id]
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  findByDocumentoId,
  findByDocumentoIds,
  replaceForDocumento,
  mapVisibilidade,
};
