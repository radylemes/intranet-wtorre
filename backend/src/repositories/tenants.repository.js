const { getPool } = require('../db/pool');

function mapTenant(row) {
  if (!row) return null;
  return {
    id: row.id,
    nome: row.nome,
    azure_tenant_id: row.azure_tenant_id,
    client_id: row.client_id,
    client_secret_ciphertext: row.client_secret_ciphertext,
    ativo: !!row.ativo,
    eh_principal: !!row.eh_principal,
  };
}

async function findByTid(tid) {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT * FROM azure_tenants WHERE azure_tenant_id = ? AND ativo = 1 LIMIT 1',
    [tid]
  );
  return mapTenant(rows[0]);
}

async function findPrincipal() {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT * FROM azure_tenants WHERE eh_principal = 1 AND ativo = 1 LIMIT 1'
  );
  return mapTenant(rows[0]);
}

async function findAll() {
  const pool = getPool();
  const [rows] = await pool.execute('SELECT * FROM azure_tenants ORDER BY nome');
  return rows.map(mapTenant);
}

async function findById(id) {
  const pool = getPool();
  const [rows] = await pool.execute('SELECT * FROM azure_tenants WHERE id = ? LIMIT 1', [id]);
  return mapTenant(rows[0]);
}

async function create(data) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (data.eh_principal) {
      await conn.execute('UPDATE azure_tenants SET eh_principal = 0');
    }
    const [result] = await conn.execute(
      `INSERT INTO azure_tenants (nome, azure_tenant_id, client_id, client_secret_ciphertext, ativo, eh_principal)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.nome,
        data.azure_tenant_id,
        data.client_id,
        data.client_secret_ciphertext || null,
        data.ativo ? 1 : 0,
        data.eh_principal ? 1 : 0,
      ]
    );
    await conn.commit();
    return findById(result.insertId);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function update(id, data) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (data.eh_principal) {
      await conn.execute('UPDATE azure_tenants SET eh_principal = 0');
    }
    const fields = [];
    const values = [];
    const allowed = ['nome', 'azure_tenant_id', 'client_id', 'client_secret_ciphertext', 'ativo', 'eh_principal'];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(key === 'ativo' || key === 'eh_principal' ? (data[key] ? 1 : 0) : data[key]);
      }
    }
    if (fields.length) {
      values.push(id);
      await conn.execute(`UPDATE azure_tenants SET ${fields.join(', ')} WHERE id = ?`, values);
    }
    await conn.commit();
    return findById(id);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function remove(id) {
  const pool = getPool();
  await pool.execute('DELETE FROM azure_tenants WHERE id = ?', [id]);
}

async function getAllowedClientIds() {
  const pool = getPool();
  const [rows] = await pool.execute('SELECT client_id FROM azure_tenants WHERE ativo = 1');
  return rows.map((r) => r.client_id);
}

module.exports = {
  findByTid,
  findPrincipal,
  findAll,
  findById,
  create,
  update,
  remove,
  getAllowedClientIds,
};
