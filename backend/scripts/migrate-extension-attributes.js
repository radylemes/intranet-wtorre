#!/usr/bin/env node
require('dotenv').config();

const { migrateExtensionAttributes } = require('../src/services/colaboradores-extension-migrate.service');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(
    dryRun
      ? 'Simulação: migrar extensionAttribute5/6 → directory extension…'
      : 'Migrando extensionAttribute5/6 → directory extension…'
  );

  const result = await migrateExtensionAttributes({ dryRun });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.erros?.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
