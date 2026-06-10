const { getPool } = require('../db/pool');

function mapColaborador(row, { includeAdId = false } = {}) {
  if (!row) return null;
  const base = {
    id: row.id,
    nome: row.nome,
    cargo: row.cargo,
    departamento: row.departamento,
    email: row.email,
    celular: row.celular,
    ramal: row.ramal,
    telefone_fixo: row.telefone_fixo ?? null,
    nasc_dia: row.nasc_dia ?? null,
    nasc_mes: row.nasc_mes ?? null,
    empresa: row.empresa,
    tenant_id: row.tenant_id,
    tem_foto: row.tem_foto == null ? null : !!row.tem_foto,
    ativo: !!row.ativo,
    sincronizado_em: row.sincronizado_em,
  };
  if (includeAdId) {
    base.ad_id = row.ad_id;
  }
  return base;
}

function mapAniversariante(row) {
  return {
    id: row.id,
    nome: row.nome,
    cargo: row.cargo,
    departamento: row.departamento,
    empresa: row.empresa,
    nasc_dia: row.nasc_dia,
    nasc_mes: row.nasc_mes,
    tem_foto: row.tem_foto == null ? null : !!row.tem_foto,
  };
}

async function upsertBatch(rows) {
  if (!rows.length) return 0;

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let count = 0;

    for (const row of rows) {
      await conn.execute(
        `INSERT INTO colaboradores (
          ad_id, tenant_id, empresa, nome, cargo, departamento, email, celular, ramal,
          telefone_fixo, nasc_dia, nasc_mes, nasc_ano, ativo, sincronizado_em
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
          tenant_id = VALUES(tenant_id),
          empresa = VALUES(empresa),
          nome = VALUES(nome),
          cargo = VALUES(cargo),
          departamento = VALUES(departamento),
          email = VALUES(email),
          celular = VALUES(celular),
          ramal = VALUES(ramal),
          telefone_fixo = VALUES(telefone_fixo),
          nasc_dia = VALUES(nasc_dia),
          nasc_mes = VALUES(nasc_mes),
          nasc_ano = VALUES(nasc_ano),
          ativo = VALUES(ativo),
          sincronizado_em = CURRENT_TIMESTAMP`,
        [
          row.ad_id,
          row.tenant_id,
          row.empresa,
          row.nome,
          row.cargo,
          row.departamento,
          row.email,
          row.celular,
          row.ramal,
          row.telefone_fixo ?? null,
          row.nasc_dia ?? null,
          row.nasc_mes ?? null,
          row.nasc_ano ?? null,
          row.ativo ? 1 : 0,
        ]
      );
      count += 1;
    }

    await conn.commit();
    return count;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function markInactiveByTenant(tenantId, activeAdIds) {
  const pool = getPool();

  if (!activeAdIds.length) {
    const [result] = await pool.execute(
      'UPDATE colaboradores SET ativo = 0 WHERE tenant_id = ? AND ativo = 1',
      [tenantId]
    );
    return result.affectedRows;
  }

  const placeholders = activeAdIds.map(() => '?').join(', ');
  const [result] = await pool.execute(
    `UPDATE colaboradores SET ativo = 0
     WHERE tenant_id = ? AND ativo = 1 AND ad_id NOT IN (${placeholders})`,
    [tenantId, ...activeAdIds]
  );
  return result.affectedRows;
}

async function findAll({ busca, empresa, departamento, ativoOnly = true } = {}) {
  const pool = getPool();
  const conditions = [];
  const values = [];

  if (ativoOnly) {
    conditions.push('ativo = 1');
  }
  if (empresa) {
    conditions.push('empresa = ?');
    values.push(empresa);
  }
  if (departamento) {
    conditions.push('departamento = ?');
    values.push(departamento);
  }
  if (busca) {
    const like = `%${busca}%`;
    conditions.push(
      '(nome LIKE ? OR email LIKE ? OR cargo LIKE ? OR departamento LIKE ? OR ramal LIKE ? OR celular LIKE ? OR telefone_fixo LIKE ?)'
    );
    values.push(like, like, like, like, like, like, like);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.execute(
    `SELECT id, nome, cargo, departamento, email, celular, ramal, telefone_fixo,
            nasc_dia, nasc_mes, empresa, tenant_id, tem_foto, ativo, sincronizado_em
     FROM colaboradores ${where} ORDER BY nome ASC`,
    values
  );
  return rows.map((r) => mapColaborador(r));
}

async function findAniversariantesByMes(mes) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, nome, cargo, departamento, empresa, nasc_dia, nasc_mes, tem_foto
     FROM colaboradores
     WHERE ativo = 1 AND nasc_mes = ? AND nasc_dia IS NOT NULL
     ORDER BY nasc_dia ASC`,
    [mes]
  );
  return rows.map((r) => mapAniversariante(r));
}

async function findDistinctDepartamentos() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT DISTINCT departamento FROM colaboradores
     WHERE ativo = 1 AND departamento IS NOT NULL AND departamento != ''
     ORDER BY departamento ASC`
  );
  return rows.map((r) => r.departamento);
}

async function findById(id) {
  const pool = getPool();
  const [rows] = await pool.execute('SELECT * FROM colaboradores WHERE id = ? LIMIT 1', [id]);
  return mapColaborador(rows[0], { includeAdId: true });
}

async function getUltimaSincronizacao() {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT MAX(sincronizado_em) AS ultima FROM colaboradores WHERE ativo = 1'
  );
  return rows[0]?.ultima ?? null;
}

async function updateTemFoto(id, temFoto) {
  const pool = getPool();
  await pool.execute('UPDATE colaboradores SET tem_foto = ? WHERE id = ?', [temFoto ? 1 : 0, id]);
}

module.exports = {
  upsertBatch,
  markInactiveByTenant,
  findAll,
  findAniversariantesByMes,
  findDistinctDepartamentos,
  findById,
  getUltimaSincronizacao,
  updateTemFoto,
  mapColaborador,
  mapAniversariante,
};
