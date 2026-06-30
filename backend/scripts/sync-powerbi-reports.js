#!/usr/bin/env node
/**
 * One-shot: lista relatórios do workspace Power BI e atualiza dataset_id/títulos locais.
 * Uso: PBI_ENABLED=1 node scripts/sync-powerbi-reports.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { env, validateEnv } = require('../src/config/env');
const powerbiApi = require('../src/services/powerbi/powerbi-api.service');
const { getPool } = require('../src/db/pool');

async function main() {
  process.env.PBI_ENABLED = '1';
  validateEnv();

  if (!env.pbiEnabled && process.env.PBI_ENABLED !== '1') {
    console.error('Defina PBI_ENABLED=1 e credenciais PBI no .env');
    process.exit(1);
  }

  const reports = await powerbiApi.listReports();
  const pool = getPool();
  let upserts = 0;

  for (const r of reports) {
    const [result] = await pool.execute(
      `INSERT INTO powerbi_relatorios (report_id, dataset_id, titulo, descricao, ordem, ativo)
       VALUES (?, ?, ?, NULL, ?, 1)
       ON DUPLICATE KEY UPDATE
         dataset_id = VALUES(dataset_id),
         titulo = VALUES(titulo)`,
      [r.id, r.datasetId || null, r.name || r.id, upserts + 1]
    );
    if (result.affectedRows) upserts += 1;
  }

  console.log(`[sync-powerbi-reports] ${reports.length} relatório(s) no workspace; ${upserts} linha(s) afetada(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[sync-powerbi-reports]', err.message);
  process.exit(1);
});
