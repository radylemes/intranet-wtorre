const { getPool } = require('../db/pool');
const { env } = require('../config/env');

function mapContainer(row) {
  if (!row) return null;
  return {
    id: row.id,
    nome: row.nome,
    rotulo: row.rotulo,
    descricao: row.descricao,
    padrao: !!row.padrao,
    ativo: !!row.ativo,
    qtd_videos: Number(row.qtd_videos ?? 0),
    criado_em: row.criado_em,
  };
}

async function listar() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT sc.*,
            (SELECT COUNT(*) FROM treinamentos t WHERE t.container = sc.nome) AS qtd_videos
     FROM storage_containers sc
     ORDER BY sc.padrao DESC, sc.rotulo ASC`
  );
  return rows.map(mapContainer);
}

async function findById(id) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT sc.*,
            (SELECT COUNT(*) FROM treinamentos t WHERE t.container = sc.nome) AS qtd_videos
     FROM storage_containers sc
     WHERE sc.id = ?
     LIMIT 1`,
    [id]
  );
  return mapContainer(rows[0]);
}

async function findByNome(nome) {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT * FROM storage_containers WHERE nome = ? LIMIT 1',
    [nome]
  );
  return mapContainer(rows[0]);
}

async function containerPadrao() {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT * FROM storage_containers WHERE padrao = 1 AND ativo = 1 LIMIT 1'
  );
  if (rows[0]) return mapContainer(rows[0]);
  return findByNome(env.treinamentosContainer);
}

async function bootstrapContainerPadrao() {
  const pool = getPool();
  const [countRows] = await pool.execute('SELECT COUNT(*) AS total FROM storage_containers');
  if (Number(countRows[0].total) > 0) return null;

  const nome = env.treinamentosContainer;
  const rotulo = 'Treinamentos (padrão)';
  await pool.execute(
    `INSERT INTO storage_containers (nome, rotulo, descricao, padrao, ativo)
     VALUES (?, ?, ?, 1, 1)`,
    [nome, rotulo, 'Container padrão para vídeos de treinamento']
  );
  return findByNome(nome);
}

async function contarTreinamentosPorContainer(nome) {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT COUNT(*) AS total FROM treinamentos WHERE container = ?',
    [nome]
  );
  return Number(rows[0].total);
}

async function criar(data) {
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO storage_containers (nome, rotulo, descricao, padrao, ativo)
     VALUES (?, ?, ?, ?, ?)`,
    [
      data.nome,
      data.rotulo,
      data.descricao ?? null,
      data.padrao ? 1 : 0,
      data.ativo !== false ? 1 : 0,
    ]
  );
  return findById(result.insertId);
}

async function atualizar(id, data) {
  const pool = getPool();
  const fields = [];
  const values = [];
  const allowed = ['rotulo', 'descricao', 'padrao', 'ativo'];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      if (key === 'padrao' || key === 'ativo') {
        values.push(data[key] ? 1 : 0);
      } else {
        values.push(data[key]);
      }
    }
  }
  if (!fields.length) return findById(id);
  values.push(id);
  await pool.execute(`UPDATE storage_containers SET ${fields.join(', ')} WHERE id = ?`, values);
  return findById(id);
}

async function definirPadrao(id) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('UPDATE storage_containers SET padrao = 0');
    await conn.execute('UPDATE storage_containers SET padrao = 1 WHERE id = ?', [id]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return findById(id);
}

async function remover(id) {
  const pool = getPool();
  await pool.execute('DELETE FROM storage_containers WHERE id = ?', [id]);
}

module.exports = {
  listar,
  findById,
  findByNome,
  containerPadrao,
  bootstrapContainerPadrao,
  contarTreinamentosPorContainer,
  criar,
  atualizar,
  definirPadrao,
  remover,
};
