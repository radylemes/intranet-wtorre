const { getPool } = require('../db/pool');

function parseBlocos(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return raw;
}

function mapPagina(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    titulo: row.titulo,
    descricao: row.descricao,
    blocos: parseBlocos(row.blocos),
    status: row.status,
    criado_por: row.criado_por,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em,
  };
}

function mapPaginaPublica(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    titulo: row.titulo,
  };
}

async function listar({ status, busca } = {}) {
  const pool = getPool();
  const conditions = [];
  const params = [];

  if (status === 'rascunho' || status === 'publicada') {
    conditions.push('status = ?');
    params.push(status);
  }
  if (busca?.trim()) {
    conditions.push('(titulo LIKE ? OR slug LIKE ?)');
    const term = `%${busca.trim()}%`;
    params.push(term, term);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.execute(
    `SELECT * FROM paginas ${where} ORDER BY atualizado_em DESC, id DESC`,
    params
  );
  return rows.map(mapPagina);
}

async function listarPublicadas() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, slug, titulo FROM paginas WHERE status = 'publicada' ORDER BY titulo ASC`
  );
  return rows.map(mapPaginaPublica);
}

async function buscarPorId(id) {
  const pool = getPool();
  const [rows] = await pool.execute('SELECT * FROM paginas WHERE id = ? LIMIT 1', [id]);
  return mapPagina(rows[0]);
}

async function buscarPorSlug(slug) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM paginas WHERE slug = ? AND status = 'publicada' LIMIT 1`,
    [slug]
  );
  return mapPagina(rows[0]);
}

async function slugExiste(slug, exceptId = null) {
  const pool = getPool();
  if (exceptId != null) {
    const [rows] = await pool.execute(
      'SELECT 1 FROM paginas WHERE slug = ? AND id != ? LIMIT 1',
      [slug, exceptId]
    );
    return rows.length > 0;
  }
  const [rows] = await pool.execute('SELECT 1 FROM paginas WHERE slug = ? LIMIT 1', [slug]);
  return rows.length > 0;
}

async function criar(data) {
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO paginas (slug, titulo, descricao, blocos, status, criado_por)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.slug,
      data.titulo,
      data.descricao || null,
      JSON.stringify(data.blocos || []),
      data.status || 'rascunho',
      data.criado_por || null,
    ]
  );
  return buscarPorId(result.insertId);
}

async function atualizar(id, data) {
  const pool = getPool();
  const fields = [];
  const values = [];
  const allowed = ['slug', 'titulo', 'descricao', 'blocos', 'status'];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(key === 'blocos' ? JSON.stringify(data[key]) : data[key]);
    }
  }

  if (!fields.length) {
    return buscarPorId(id);
  }

  values.push(id);
  await pool.execute(`UPDATE paginas SET ${fields.join(', ')} WHERE id = ?`, values);
  return buscarPorId(id);
}

async function remover(id) {
  const pool = getPool();
  await pool.execute('DELETE FROM paginas WHERE id = ?', [id]);
}

module.exports = {
  mapPagina,
  listar,
  listarPublicadas,
  buscarPorId,
  buscarPorSlug,
  slugExiste,
  criar,
  atualizar,
  remover,
};
