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
  SELECT te.treinamento_id, te.pagina_id, te.categoria_id,
         p.nome AS pagina_nome, p.slug AS pagina_slug,
         c.nome AS categoria_nome, c.slug AS categoria_slug
  FROM treinamento_entidades te
  INNER JOIN documentos_paginas p ON p.id = te.pagina_id
  LEFT JOIN categorias_documentos c ON c.id = te.categoria_id
`;

async function findByTreinamentoId(treinamentoId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `${SELECT_VIS} WHERE te.treinamento_id = ? ORDER BY p.ordem ASC, p.nome ASC`,
    [treinamentoId]
  );
  return rows.map(mapVisibilidade);
}

async function findByTreinamentoIds(treinamentoIds) {
  if (!treinamentoIds?.length) return new Map();
  const pool = getPool();
  const placeholders = treinamentoIds.map(() => '?').join(',');
  const [rows] = await pool.execute(
    `${SELECT_VIS} WHERE te.treinamento_id IN (${placeholders}) ORDER BY p.ordem ASC, p.nome ASC`,
    treinamentoIds
  );
  const map = new Map();
  for (const row of rows) {
    const list = map.get(row.treinamento_id) ?? [];
    list.push(mapVisibilidade(row));
    map.set(row.treinamento_id, list);
  }
  return map;
}

async function replaceForTreinamento(treinamentoId, visibilidades) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM treinamento_entidades WHERE treinamento_id = ?', [treinamentoId]);
    for (const v of visibilidades) {
      await conn.execute(
        `INSERT INTO treinamento_entidades (treinamento_id, pagina_id, categoria_id)
         VALUES (?, ?, ?)`,
        [treinamentoId, v.pagina_id, v.categoria_id]
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

async function isVisibleOnPagina(treinamentoId, paginaId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT 1 FROM treinamento_entidades WHERE treinamento_id = ? AND pagina_id = ? LIMIT 1',
    [treinamentoId, paginaId]
  );
  return rows.length > 0;
}

module.exports = {
  findByTreinamentoId,
  findByTreinamentoIds,
  replaceForTreinamento,
  isVisibleOnPagina,
  mapVisibilidade,
};
