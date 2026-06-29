const { getPool } = require('../db/pool');
const catRepo = require('./categorias-documentos.repository');
const docRepo = require('./documentos.repository');
const treinamentoEntidadesRepo = require('./treinamento-entidades.repository');

const SELECT_PUBLICO = `
  SELECT t.id, t.titulo, t.descricao, t.area, t.setor_id, t.duracao_seg, t.destaque,
         (t.thumb_blob IS NOT NULL) AS tem_thumb,
         te.pagina_id, te.categoria_id,
         p.slug AS pagina_slug, p.nome AS pagina_nome,
         c.nome AS categoria_nome, c.slug AS categoria_slug, c.icone AS categoria_icone,
         s.nome AS setor_nome, s.slug AS setor_slug, s.cor AS setor_cor
  FROM treinamentos t
  INNER JOIN treinamento_entidades te ON te.treinamento_id = t.id
  INNER JOIN documentos_paginas p ON te.pagina_id = p.id AND p.ativo = 1
  LEFT JOIN categorias_documentos c ON te.categoria_id = c.id
  LEFT JOIN documentos_setores s ON t.setor_id = s.id
`;

const SELECT_ADMIN = `
  SELECT t.id, t.titulo, t.descricao, t.area, t.setor_id, t.duracao_seg, t.destaque,
         (t.thumb_blob IS NOT NULL) AS tem_thumb,
         t.pagina_id, t.categoria_id, t.container, t.blob_name, t.thumb_blob, t.ativo, t.ordem, t.criado_em, t.atualizado_em,
         p.slug AS pagina_slug, p.nome AS pagina_nome,
         c.nome AS categoria_nome, c.slug AS categoria_slug, c.icone AS categoria_icone,
         s.nome AS setor_nome, s.slug AS setor_slug, s.cor AS setor_cor
  FROM treinamentos t
  INNER JOIN documentos_paginas p ON t.pagina_id = p.id
  LEFT JOIN categorias_documentos c ON t.categoria_id = c.id
  LEFT JOIN documentos_setores s ON t.setor_id = s.id
`;

function mapSetor(row) {
  if (row.setor_id == null || row.setor_nome == null) return null;
  return {
    id: row.setor_id,
    nome: row.setor_nome,
    slug: row.setor_slug,
    cor: row.setor_cor,
  };
}

function mapPublico(row) {
  if (!row) return null;
  return {
    id: row.id,
    titulo: row.titulo,
    descricao: row.descricao,
    area: row.area,
    setor_id: row.setor_id ?? null,
    setor: mapSetor(row),
    duracao_seg: row.duracao_seg,
    destaque: !!row.destaque,
    tem_thumb: row.tem_thumb != null ? !!row.tem_thumb : !!row.thumb_blob,
    pagina_id: row.pagina_id,
    pagina_slug: row.pagina_slug,
    pagina_nome: row.pagina_nome,
    categoria_id: row.categoria_id ?? null,
    categoria_nome: row.categoria_nome ?? null,
    categoria_slug: row.categoria_slug ?? null,
    categoria_icone: row.categoria_icone ?? null,
    tem_categoria: row.categoria_id != null,
  };
}

function mapAdmin(row, visibilidades = []) {
  if (!row) return null;
  return {
    ...mapPublico(row),
    container: row.container,
    ativo: !!row.ativo,
    ordem: row.ordem,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em,
    visibilidades,
  };
}

function mapInterno(row, visibilidades = []) {
  if (!row) return null;
  return {
    ...mapAdmin(row, visibilidades),
    blob_name: row.blob_name,
    thumb_blob: row.thumb_blob,
    criado_por: row.criado_por,
  };
}

async function buildCategoriaFilterEntidade(categoriaSlug, paginaId, semCategoria) {
  if (semCategoria) {
    return { sql: ' AND te.categoria_id IS NULL', params: [] };
  }
  if (!categoriaSlug) {
    return { sql: '', params: [] };
  }
  const cat = await catRepo.findBySlug(categoriaSlug, paginaId);
  if (!cat) {
    return { sql: ' AND 1 = 0', params: [] };
  }
  const ids = await catRepo.collectSubtreeIds(cat.id);
  if (!ids.length) {
    return { sql: ' AND 1 = 0', params: [] };
  }
  const placeholders = ids.map(() => '?').join(',');
  return { sql: ` AND te.categoria_id IN (${placeholders})`, params: ids };
}

function buildSetorFilterSql(setorFilter) {
  if (!setorFilter || setorFilter.type === 'all') {
    return { sql: '', params: [] };
  }
  if (setorFilter.type === 'none') {
    return { sql: ' AND t.setor_id IS NULL', params: [] };
  }
  if (setorFilter.type === 'id') {
    return { sql: ' AND t.setor_id = ?', params: [setorFilter.value] };
  }
  return { sql: '', params: [] };
}

async function findAllPublico({
  paginaSlug = 'wtorre',
  categoriaSlug = null,
  semCategoria = false,
  setorFilter = { type: 'all' },
} = {}) {
  const pool = getPool();
  const [pagRows] = await pool.execute(
    'SELECT id FROM documentos_paginas WHERE slug = ? AND ativo = 1 LIMIT 1',
    [paginaSlug]
  );
  const paginaId = pagRows[0]?.id;
  if (!paginaId) return [];

  const catFilter = await buildCategoriaFilterEntidade(categoriaSlug, paginaId, semCategoria);
  const setorFilterSql = buildSetorFilterSql(setorFilter);
  const [rows] = await pool.execute(
    `${SELECT_PUBLICO}
     WHERE t.ativo = 1 AND te.pagina_id = ? AND p.slug = ?${catFilter.sql}${setorFilterSql.sql}
     ORDER BY t.destaque DESC, t.ordem ASC, t.criado_em DESC`,
    [paginaId, paginaSlug, ...catFilter.params, ...setorFilterSql.params]
  );
  return rows.map(mapPublico);
}

async function findAllAdmin({ paginaId = null } = {}) {
  const pool = getPool();
  let rows;
  if (paginaId != null) {
    [rows] = await pool.execute(
      `${SELECT_ADMIN}
       INNER JOIN treinamento_entidades te ON te.treinamento_id = t.id AND te.pagina_id = ?
       ORDER BY t.destaque DESC, t.ordem ASC, t.criado_em DESC`,
      [paginaId]
    );
    const seen = new Set();
    rows = rows.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  } else {
    [rows] = await pool.execute(
      `${SELECT_ADMIN}
       ORDER BY t.destaque DESC, t.ordem ASC, t.criado_em DESC`
    );
  }
  const ids = rows.map((r) => r.id);
  const visMap = await treinamentoEntidadesRepo.findByTreinamentoIds(ids);
  return rows.map((row) => mapAdmin(row, visMap.get(row.id) ?? []));
}

async function findById(id) {
  const pool = getPool();
  const [rows] = await pool.execute('SELECT * FROM treinamentos WHERE id = ? LIMIT 1', [id]);
  if (!rows[0]) return null;
  const [joined] = await pool.execute(`${SELECT_ADMIN} WHERE t.id = ? LIMIT 1`, [id]);
  const visibilidades = await treinamentoEntidadesRepo.findByTreinamentoId(id);
  return mapInterno(joined[0] ?? rows[0], visibilidades);
}

async function criar(data) {
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO treinamentos
      (titulo, descricao, categoria, pagina_id, categoria_id, setor_id, area, duracao_seg, container, blob_name, thumb_blob,
       destaque, ordem, ativo, criado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.titulo,
      data.descricao ?? null,
      null,
      data.pagina_id,
      data.categoria_id ?? null,
      data.setor_id ?? null,
      data.area ?? null,
      data.duracao_seg ?? null,
      data.container,
      data.blob_name,
      data.thumb_blob ?? null,
      data.destaque ? 1 : 0,
      data.ordem ?? null,
      data.ativo !== false ? 1 : 0,
      data.criado_por ?? null,
    ]
  );
  return findById(result.insertId);
}

async function atualizar(id, data) {
  const pool = getPool();
  const fields = [];
  const values = [];
  const allowed = [
    'titulo',
    'descricao',
    'pagina_id',
    'categoria_id',
    'setor_id',
    'area',
    'duracao_seg',
    'container',
    'blob_name',
    'thumb_blob',
    'destaque',
    'ordem',
    'ativo',
  ];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      if (key === 'destaque' || key === 'ativo') {
        values.push(data[key] ? 1 : 0);
      } else {
        values.push(data[key]);
      }
    }
  }
  if (!fields.length) return findById(id);
  values.push(id);
  await pool.execute(`UPDATE treinamentos SET ${fields.join(', ')} WHERE id = ?`, values);
  return findById(id);
}

async function remover(id) {
  const existing = await findById(id);
  if (!existing) return null;
  const pool = getPool();
  await pool.execute('DELETE FROM treinamentos WHERE id = ?', [id]);
  return {
    container: existing.container,
    blob_name: existing.blob_name,
    thumb_blob: existing.thumb_blob,
  };
}

module.exports = {
  findAllPublico,
  findAllAdmin,
  findById,
  criar,
  atualizar,
  remover,
  mapPublico,
  mapAdmin,
};
