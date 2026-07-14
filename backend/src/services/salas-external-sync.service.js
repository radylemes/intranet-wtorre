const fs = require('node:fs/promises');
const path = require('node:path');
const { env } = require('../config/env');

async function syncUiConfigToExternal(config) {
  const dataDir = env.salasSyncDataDir?.trim();
  if (!dataDir) {
    console.warn(
      '[salas-sync] SALAS_SYNC_DATA_DIR não configurado; API externa pode ficar desatualizada.'
    );
    return;
  }

  await fs.mkdir(dataDir, { recursive: true });
  const target = path.join(dataDir, 'ui-config.json');
  await fs.writeFile(target, JSON.stringify(config, null, 2), 'utf-8');
}

async function syncLogosToExternal() {
  const dataDir = env.salasSyncDataDir?.trim();
  if (!dataDir) return;

  const sourceDir = env.salasLogosDir;
  const targetDir = path.join(dataDir, 'logos');

  await fs.mkdir(targetDir, { recursive: true });

  let entries = [];
  try {
    entries = await fs.readdir(sourceDir);
  } catch (err) {
    if (err?.code === 'ENOENT') return;
    throw err;
  }

  for (const name of entries) {
    const src = path.join(sourceDir, name);
    const dest = path.join(targetDir, name);
    const stat = await fs.stat(src);
    if (!stat.isFile()) continue;
    await fs.copyFile(src, dest);
  }
}

async function syncAll(config) {
  await syncUiConfigToExternal(config);
  await syncLogosToExternal();
}

module.exports = {
  syncUiConfigToExternal,
  syncLogosToExternal,
  syncAll,
};
