const { getPool } = require('../db/pool');

function mapRelatorio(row) {
  if (!row) return null;
  return {
    id: row.id,
    reportId: row.report_id,
    datasetId: row.dataset_id,
    titulo: row.titulo,
    descricao: row.descricao,
    ordem: row.ordem,
    ativo: !!row.ativo,
    embedUrl: row.embed_url || null,
  };
}

async function listRelatoriosPorSetor(setorId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT r.id, r.report_id, r.dataset_id, r.titulo, r.descricao, r.ordem, r.ativo
     FROM powerbi_relatorios r
     INNER JOIN powerbi_relatorio_setores rs ON rs.report_id = r.report_id
     WHERE rs.setor_id = ? AND r.ativo = 1
     ORDER BY r.ordem ASC, r.titulo ASC`,
    [setorId]
  );
  return rows.map(mapRelatorio);
}

async function isRelatorioAutorizado(reportId, setorId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT 1
     FROM powerbi_relatorios r
     INNER JOIN powerbi_relatorio_setores rs ON rs.report_id = r.report_id
     WHERE r.report_id = ? AND rs.setor_id = ? AND r.ativo = 1
     LIMIT 1`,
    [reportId, setorId]
  );
  return rows.length > 0;
}

async function findRelatorioByReportId(reportId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT id, report_id, dataset_id, titulo, descricao, ordem, ativo FROM powerbi_relatorios WHERE report_id = ? LIMIT 1',
    [reportId]
  );
  return mapRelatorio(rows[0]);
}

async function getRlsRolePorSetor(setorId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT rls_role FROM powerbi_setor_rls_role WHERE setor_id = ? LIMIT 1',
    [setorId]
  );
  return rows[0]?.rls_role || null;
}

async function upsertDatasetIdFromApi(reportId, datasetId) {
  if (!reportId || !datasetId) return;
  const pool = getPool();
  await pool.execute(
    'UPDATE powerbi_relatorios SET dataset_id = ? WHERE report_id = ? AND (dataset_id IS NULL OR dataset_id = ?)',
    [datasetId, reportId, datasetId]
  );
}

module.exports = {
  listRelatoriosPorSetor,
  isRelatorioAutorizado,
  findRelatorioByReportId,
  getRlsRolePorSetor,
  upsertDatasetIdFromApi,
};
