const { getPool } = require('../db/pool');

function mapPublico(row) {
  if (!row) return null;
  return {
    id: row.id,
    titulo: row.titulo,
    descricao: row.descricao,
    categoria: row.categoria,
    area: row.area,
    duracao_seg: row.duracao_seg,
    destaque: !!row.destaque,
    tem_thumb: row.tem_thumb != null ? !!row.tem_thumb : !!row.thumb_blob,
  };
}

function mapAdmin(row) {
  if (!row) return null;
  return {
    ...mapPublico(row),
    container: row.container,
    ativo: !!row.ativo,
    ordem: row.ordem,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em,
  };
}

function mapInterno(row) {
  if (!row) return null;
  return {
    ...mapAdmin(row),
    blob_name: row.blob_name,
    thumb_blob: row.thumb_blob,
    criado_por: row.criado_por,
  };
}

async function findAllPublico() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, titulo, descricao, categoria, area, duracao_seg, destaque,
            (thumb_blob IS NOT NULL) AS tem_thumb
     FROM treinamentos
     WHERE ativo = 1
     ORDER BY destaque DESC, ordem ASC, criado_em DESC`
  );
  return rows.map(mapPublico);
}

async function findAllAdmin() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, titulo, descricao, categoria, area, duracao_seg, destaque,
            (thumb_blob IS NOT NULL) AS tem_thumb,
            container, ativo, ordem, criado_em, atualizado_em
     FROM treinamentos
     ORDER BY destaque DESC, ordem ASC, criado_em DESC`
  );
  return rows.map(mapAdmin);
}

async function findById(id) {
  const pool = getPool();
  const [rows] = await pool.execute('SELECT * FROM treinamentos WHERE id = ? LIMIT 1', [id]);
  return mapInterno(rows[0]);
}

async function criar(data) {
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO treinamentos
      (titulo, descricao, categoria, area, duracao_seg, container, blob_name, thumb_blob,
       destaque, ordem, ativo, criado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.titulo,
      data.descricao ?? null,
      data.categoria,
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
    'categoria',
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
};
