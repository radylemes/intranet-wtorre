const fs = require('node:fs/promises');
const path = require('node:path');
const { env } = require('../config/env');
const salasUiConfigService = require('./salas-ui-config.service');
const salasService = require('./salas.service');
const { resolveApiLocalidade, resolveRoomTab } = require('./salas-ui-config.resolver');

const ALLOWED_EXTENSIONS = new Set(['.svg', '.png', '.jpg', '.jpeg']);
const ALLOWED_MIME_TYPES = new Set(['image/svg+xml', 'image/png', 'image/jpeg']);

async function getAdminUiConfig() {
  return salasUiConfigService.getAdminUiConfig();
}

async function saveAdminUiConfig(config) {
  return salasUiConfigService.saveAdminUiConfig(config);
}

async function getAdminRooms() {
  const { config } = await salasUiConfigService.getAdminUiConfig();
  const localidades = [...new Set(Object.values(config.domainToApiLocalidade || {}))];
  const rooms = [];

  for (const localidade of localidades) {
    let listed = [];
    try {
      const res = await salasService.getRooms(localidade);
      listed = res?.rooms || [];
    } catch {
      listed = [];
    }
    for (const room of listed) {
      const email = String(room.email || '')
        .trim()
        .toLowerCase();
      const { tabId, source } = resolveRoomTab(email, config);
      rooms.push({
        name: room.name,
        email,
        apiLocalidade: resolveApiLocalidade(email, config) || localidade,
        tabId,
        tabSource: source,
      });
    }
  }

  rooms.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  return { rooms };
}

async function ensureLogosDir() {
  await fs.mkdir(env.salasLogosDir, { recursive: true });
}

async function removeLogoFile(filename) {
  if (!filename) return;
  try {
    await fs.unlink(path.join(env.salasLogosDir, filename));
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
  }
}

async function uploadTabLogo(tabId, file) {
  const normalizedTabId = String(tabId || '')
    .trim()
    .toLowerCase();
  const { config } = await salasUiConfigService.getAdminUiConfig();
  const tab = config.tabs.find((entry) => entry.id === normalizedTabId);
  if (!tab) {
    const err = new Error(`Aba não encontrada: ${tabId}`);
    err.status = 404;
    throw err;
  }

  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
    const err = new Error('Formato inválido. Use SVG, PNG ou JPEG.');
    err.status = 400;
    throw err;
  }

  const filename = `${normalizedTabId}${ext}`;
  await ensureLogosDir();
  await fs.writeFile(path.join(env.salasLogosDir, filename), file.buffer);

  if (tab.logoFile && tab.logoFile !== filename) {
    await removeLogoFile(tab.logoFile);
  }

  const updatedTabs = config.tabs.map((entry) =>
    entry.id === normalizedTabId ? { ...entry, logoFile: filename } : entry
  );
  return salasUiConfigService.saveAdminUiConfig({
    config: { ...config, tabs: updatedTabs },
  });
}

async function deleteTabLogo(tabId) {
  const normalizedTabId = String(tabId || '')
    .trim()
    .toLowerCase();
  const { config } = await salasUiConfigService.getAdminUiConfig();
  const tab = config.tabs.find((entry) => entry.id === normalizedTabId);
  if (!tab) {
    const err = new Error(`Aba não encontrada: ${tabId}`);
    err.status = 404;
    throw err;
  }

  if (tab.logoFile) {
    await removeLogoFile(tab.logoFile);
  }

  const updatedTabs = config.tabs.map((entry) =>
    entry.id === normalizedTabId ? { ...entry, logoFile: null } : entry
  );
  return salasUiConfigService.saveAdminUiConfig({
    config: { ...config, tabs: updatedTabs },
  });
}

async function listRegisteredLogos() {
  const names = new Set();

  const collect = async (dir) => {
    if (!dir?.trim()) return;
    try {
      const entries = await fs.readdir(dir);
      for (const name of entries) {
        const filePath = path.join(dir, name);
        const stat = await fs.stat(filePath);
        if (!stat.isFile()) continue;
        const ext = path.extname(name).toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext)) continue;
        names.add(name);
      }
    } catch (err) {
      if (err?.code !== 'ENOENT') throw err;
    }
  };

  await collect(env.salasLogosDir);
  await collect(path.join(env.salasSyncDataDir || '', 'logos'));

  return {
    files: [...names]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map((name) => ({ name })),
  };
}

async function resolveLogoPath(safeName) {
  const candidates = [
    path.join(env.salasLogosDir, safeName),
    path.join(env.salasSyncDataDir || '', 'logos', safeName),
  ];
  for (const filePath of candidates) {
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      /* tenta próximo */
    }
  }
  return null;
}

async function proxyLogo(fileName) {
  const safeName = String(fileName || '').replace(/[^a-zA-Z0-9._-]/g, '');
  if (!safeName) {
    const err = new Error('Arquivo de logo inválido.');
    err.status = 400;
    throw err;
  }

  const filePath = await resolveLogoPath(safeName);
  if (!filePath) {
    const notFound = new Error('Logo não encontrado.');
    notFound.status = 404;
    throw notFound;
  }

  const buffer = await fs.readFile(filePath);

  const ext = path.extname(safeName).toLowerCase();
  const contentType =
    ext === '.svg'
      ? 'image/svg+xml'
      : ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : 'application/octet-stream';

  return { buffer, contentType };
}

module.exports = {
  getAdminUiConfig,
  saveAdminUiConfig,
  getAdminRooms,
  listRegisteredLogos,
  uploadTabLogo,
  deleteTabLogo,
  proxyLogo,
};
