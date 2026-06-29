const { getPool } = require('../db/pool');

function mapColaborador(row, { includeAdId = false, includeAdminFields = false } = {}) {
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
  if (includeAdId || includeAdminFields) {
    base.ad_id = row.ad_id;
  }
  if (includeAdminFields) {
    base.nasc_ano = row.nasc_ano ?? null;
    base.tenant_nome = row.tenant_nome ?? null;
  }
  return base;
}

function buildWhereClause({ busca, empresa, departamento, ativoFilter } = {}) {
  const conditions = [];
  const values = [];

  if (ativoFilter === '1' || ativoFilter === true) {
    conditions.push('c.ativo = 1');
  } else if (ativoFilter === '0' || ativoFilter === false) {
    conditions.push('c.ativo = 0');
  }

  if (empresa) {
    conditions.push('c.empresa = ?');
    values.push(empresa);
  }
  if (departamento) {
    conditions.push('c.departamento = ?');
    values.push(departamento);
  }
  if (busca) {
    const like = `%${busca}%`;
    conditions.push(
      '(c.nome LIKE ? OR c.email LIKE ? OR c.cargo LIKE ? OR c.departamento LIKE ? OR c.ramal LIKE ? OR c.celular LIKE ? OR c.telefone_fixo LIKE ?)'
    );
    values.push(like, like, like, like, like, like, like);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, values };
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
  const { where, values } = buildWhereClause({
    busca,
    empresa,
    departamento,
    ativoFilter: ativoOnly ? '1' : 'todos',
  });

  const [rows] = await pool.execute(
    `SELECT c.id, c.nome, c.cargo, c.departamento, c.email, c.celular, c.ramal, c.telefone_fixo,
            c.nasc_dia, c.nasc_mes, c.empresa, c.tenant_id, c.tem_foto, c.ativo, c.sincronizado_em
     FROM colaboradores c ${where} ORDER BY c.nome ASC`,
    values
  );
  return rows.map((r) => mapColaborador(r));
}

async function findAllPaginated({ busca, empresa, departamento, ativoFilter = '1', page = 1, limit = 50 } = {}) {
  const pool = getPool();
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
  const offset = (safePage - 1) * safeLimit;

  const { where, values } = buildWhereClause({ busca, empresa, departamento, ativoFilter });

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM colaboradores c ${where}`,
    values
  );
  const total = countRows[0]?.total ?? 0;

  const [rows] = await pool.execute(
    `SELECT c.id, c.ad_id, c.nome, c.cargo, c.departamento, c.email, c.celular, c.ramal,
            c.telefone_fixo, c.nasc_dia, c.nasc_mes, c.nasc_ano, c.empresa, c.tenant_id,
            c.tem_foto, c.ativo, c.sincronizado_em, t.nome AS tenant_nome
     FROM colaboradores c
     LEFT JOIN azure_tenants t ON t.id = c.tenant_id
     ${where}
     ORDER BY c.nome ASC
     LIMIT ? OFFSET ?`,
    [...values, safeLimit, offset]
  );

  return {
    rows: rows.map((r) => mapColaborador(r, { includeAdminFields: true })),
    total,
    page: safePage,
    limit: safeLimit,
  };
}

async function countStats() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
       SUM(ativo = 1) AS ativos,
       SUM(ativo = 0) AS inativos,
       MAX(sincronizado_em) AS ultima_sync
     FROM colaboradores`
  );
  const row = rows[0] || {};
  return {
    ativos: Number(row.ativos) || 0,
    inativos: Number(row.inativos) || 0,
    ultima_sync: row.ultima_sync ?? null,
  };
}

async function findAdminById(id) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT c.*, t.nome AS tenant_nome
     FROM colaboradores c
     LEFT JOIN azure_tenants t ON t.id = c.tenant_id
     WHERE c.id = ?
     LIMIT 1`,
    [id]
  );
  return mapColaborador(rows[0], { includeAdminFields: true });
}

async function findDistinctEmpresas() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT DISTINCT empresa FROM colaboradores
     WHERE empresa IS NOT NULL AND empresa != ''
     ORDER BY empresa ASC`
  );
  return rows.map((r) => r.empresa);
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

async function findDepartamentoFallback(adId, email) {
  const pool = getPool();
  const tentativas = [
    adId ? { sql: 'ad_id = ?', val: adId } : null,
    email ? { sql: 'email = ?', val: email } : null,
  ].filter(Boolean);

  for (const t of tentativas) {
    const [rows] = await pool.execute(
      `SELECT departamento, empresa, cargo FROM colaboradores
       WHERE ${t.sql} AND ativo = 1 LIMIT 1`,
      [t.val]
    );
    const row = rows[0];
    if (!row) continue;
    for (const campo of [row.departamento, row.empresa, row.cargo]) {
      if (campo && String(campo).trim()) return String(campo).trim();
    }
  }
  return null;
}

async function findDepartamentoByAdId(adId) {
  if (!adId) return null;
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT departamento FROM colaboradores
     WHERE ad_id = ? AND ativo = 1 AND departamento IS NOT NULL AND departamento != ''
     LIMIT 1`,
    [adId]
  );
  const dept = rows[0]?.departamento;
  return dept ? String(dept).trim() : null;
}

async function findDepartamentoByEmail(email) {
  if (!email) return null;
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT departamento FROM colaboradores
     WHERE email = ? AND ativo = 1 AND departamento IS NOT NULL AND departamento != ''
     LIMIT 1`,
    [email]
  );
  const dept = rows[0]?.departamento;
  return dept ? String(dept).trim() : null;
}

module.exports = {
  upsertBatch,
  markInactiveByTenant,
  findAll,
  findAllPaginated,
  countStats,
  findAdminById,
  findDistinctEmpresas,
  findAniversariantesByMes,
  findDistinctDepartamentos,
  findById,
  getUltimaSincronizacao,
  updateTemFoto,
  findDepartamentoByAdId,
  findDepartamentoByEmail,
  findDepartamentoFallback,
  mapColaborador,
  mapAniversariante,
};
