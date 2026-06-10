const { getPool } = require('../db/pool');

function mapCategoria(row) {
  if (!row) return null;
  return {
    id: row.id,
    nome: row.nome,
    slug: row.slug,
    descricao: row.descricao,
    icone: row.icone,
    parent_id: row.parent_id,
    ordem: row.ordem,
    ativo: !!row.ativo,
    documentos_count: row.documentos_count != null ? Number(row.documentos_count) : undefined,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em,
  };
}

function buildTree(rows, options = {}) {
  const { filterActive = false, includeAdminFields = false } = options;
  const filtered = rows.filter((row) => !(filterActive && !row.ativo));

  const byId = new Map();
  for (const row of filtered) {
    byId.set(row.id, { ...mapCategoria(row), children: [] });
  }

  const roots = [];
  for (const node of byId.values()) {
    if (node.parent_id != null && byId.has(node.parent_id)) {
      byId.get(node.parent_id).children.push(node);
    } else if (node.parent_id == null) {
      roots.push(node);
    }
  }

  const sortChildren = (items) => {
    items.sort((a, b) => a.ordem - b.ordem);
    for (const item of items) {
      sortChildren(item.children);
    }
  };
  sortChildren(roots);

  const formatNodes = (items) =>
    items.map(({ parent_id, ativo, children, documentos_count, ...rest }) => {
      const node = { ...rest, children: formatNodes(children || []) };
      if (includeAdminFields) {
        node.ativo = ativo;
        node.parent_id = parent_id;
        if (documentos_count != null) node.documentos_count = documentos_count;
      }
      return node;
    });

  return formatNodes(roots);
}

async function findAllFlat(includeCounts = false) {
  const pool = getPool();
  const sql = includeCounts
    ? `SELECT c.*, (SELECT COUNT(*) FROM documentos d WHERE d.categoria_id = c.id AND d.ativo = 1) AS documentos_count
       FROM categorias_documentos c
       ORDER BY c.parent_id IS NULL DESC, c.parent_id, c.ordem, c.id`
    : 'SELECT * FROM categorias_documentos ORDER BY parent_id IS NULL DESC, parent_id, ordem, id';
  const [rows] = await pool.execute(sql);
  return rows.map(mapCategoria);
}

async function findById(id) {
  const pool = getPool();
  const [rows] = await pool.execute('SELECT * FROM categorias_documentos WHERE id = ? LIMIT 1', [id]);
  return mapCategoria(rows[0]);
}

async function findBySlug(slug) {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT * FROM categorias_documentos WHERE slug = ? LIMIT 1',
    [slug]
  );
  return mapCategoria(rows[0]);
}

async function create(data) {
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO categorias_documentos (nome, slug, descricao, icone, parent_id, ordem, ativo)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.nome,
      data.slug,
      data.descricao ?? null,
      data.icone ?? null,
      data.parent_id ?? null,
      data.ordem ?? 0,
      data.ativo !== false ? 1 : 0,
    ]
  );
  return findById(result.insertId);
}

async function update(id, data) {
  const pool = getPool();
  const fields = [];
  const values = [];
  const allowed = ['nome', 'slug', 'descricao', 'icone', 'parent_id', 'ordem', 'ativo'];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      if (key === 'ativo') {
        values.push(data[key] ? 1 : 0);
      } else if (key === 'parent_id' && (data[key] === '' || data[key] == null)) {
        values.push(null);
      } else {
        values.push(data[key]);
      }
    }
  }

  if (fields.length) {
    values.push(id);
    await pool.execute(`UPDATE categorias_documentos SET ${fields.join(', ')} WHERE id = ?`, values);
  }
  return findById(id);
}

async function remove(id) {
  const pool = getPool();
  await pool.execute('DELETE FROM categorias_documentos WHERE id = ?', [id]);
}

async function reorderBatch(items) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const item of items) {
      await conn.execute('UPDATE categorias_documentos SET parent_id = ?, ordem = ? WHERE id = ?', [
        item.parent_id ?? null,
        item.ordem,
        item.id,
      ]);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function isDescendant(ancestorId, nodeId) {
  let current = await findById(nodeId);
  while (current?.parent_id) {
    if (current.parent_id === ancestorId) return true;
    current = await findById(current.parent_id);
  }
  return false;
}

module.exports = {
  findAllFlat,
  findById,
  findBySlug,
  create,
  update,
  remove,
  reorderBatch,
  buildTree,
  mapCategoria,
  isDescendant,
};
