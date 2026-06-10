const { getPool } = require('../db/pool');

function mapMenuItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    label: row.label,
    url: row.url,
    parent_id: row.parent_id,
    ordem: row.ordem,
    abrir_nova_aba: !!row.abrir_nova_aba,
    icone: row.icone,
    cabecalho: row.cabecalho,
    ativo: !!row.ativo,
    visivel_perfil: row.visivel_perfil,
  };
}

function buildTree(rows, options = {}) {
  const includeAdminFields = !!options.includeAdminFields;
  const { filterActive = false, perfil = null } = options;
  const filtered = rows.filter((row) => {
    if (filterActive && !row.ativo) return false;
    if (perfil && row.visivel_perfil && row.visivel_perfil !== perfil) return false;
    return true;
  });

  const byId = new Map();
  for (const row of filtered) {
    byId.set(row.id, { ...mapMenuItem(row), children: [] });
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
    items.map(({ parent_id, ativo, visivel_perfil, children, ...rest }) => {
      const node = { ...rest, children: formatNodes(children || []) };
      if (includeAdminFields) {
        node.ativo = ativo;
        node.visivel_perfil = visivel_perfil;
      }
      return node;
    });

  return formatNodes(roots);
}

async function findAllFlat() {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT * FROM menu_items ORDER BY parent_id IS NULL DESC, parent_id, ordem, id'
  );
  return rows.map(mapMenuItem);
}

async function findById(id) {
  const pool = getPool();
  const [rows] = await pool.execute('SELECT * FROM menu_items WHERE id = ? LIMIT 1', [id]);
  return mapMenuItem(rows[0]);
}

async function create(data) {
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO menu_items (label, url, parent_id, ordem, abrir_nova_aba, icone, cabecalho, ativo, visivel_perfil)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.label,
      data.url ?? null,
      data.parent_id ?? null,
      data.ordem ?? 0,
      data.abrir_nova_aba ? 1 : 0,
      data.icone ?? null,
      data.cabecalho ?? null,
      data.ativo !== false ? 1 : 0,
      data.visivel_perfil ?? null,
    ]
  );
  return findById(result.insertId);
}

async function update(id, data) {
  const pool = getPool();
  const fields = [];
  const values = [];
  const allowed = [
    'label',
    'url',
    'parent_id',
    'ordem',
    'abrir_nova_aba',
    'icone',
    'cabecalho',
    'ativo',
    'visivel_perfil',
  ];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      if (key === 'abrir_nova_aba' || key === 'ativo') {
        values.push(data[key] ? 1 : 0);
      } else if (key === 'parent_id' && data[key] === '') {
        values.push(null);
      } else {
        values.push(data[key]);
      }
    }
  }

  if (fields.length) {
    values.push(id);
    await pool.execute(`UPDATE menu_items SET ${fields.join(', ')} WHERE id = ?`, values);
  }
  return findById(id);
}

async function remove(id) {
  const pool = getPool();
  await pool.execute('DELETE FROM menu_items WHERE id = ?', [id]);
}

async function reorderBatch(items) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const item of items) {
      await conn.execute('UPDATE menu_items SET parent_id = ?, ordem = ? WHERE id = ?', [
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

module.exports = {
  findAllFlat,
  findById,
  create,
  update,
  remove,
  reorderBatch,
  buildTree,
  mapMenuItem,
};
