const { getPool } = require('../db/pool');
const menuRepo = require('../repositories/menu.repository');
const paginaRepo = require('../repositories/documentos-paginas.repository');

const DOCUMENTOS_URL = '/documentos';
const TREINAMENTOS_URL = '/treinamentos';

function paginaMenuUrl(slug) {
  return `${DOCUMENTOS_URL}/${slug}`;
}

function treinamentoMenuUrl(slug) {
  return `${DOCUMENTOS_URL}/${slug}?cat=treinamentos`;
}

function treinamentoMenuLabel(pagina) {
  return `Treinamentos — ${pagina.nome}`;
}

async function ensureDocumentosMenuParent() {
  let parentId = await findDocumentosMenuParent();
  if (parentId) return parentId;

  const item = await menuRepo.create({
    label: 'Documentos',
    url: DOCUMENTOS_URL,
    parent_id: null,
    ordem: 99,
    abrir_nova_aba: false,
    cabecalho: 'Repositórios',
    ativo: true,
  });
  return item.id;
}

async function findDocumentosMenuParent() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id FROM menu_items
     WHERE parent_id IS NULL AND (url = ? OR label = 'Documentos')
     ORDER BY url = ? DESC, id ASC
     LIMIT 1`,
    [DOCUMENTOS_URL, DOCUMENTOS_URL]
  );
  return rows[0]?.id ?? null;
}

async function findMenuItemByPaginaSlug(slug) {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT id FROM menu_items WHERE url = ? LIMIT 1',
    [paginaMenuUrl(slug)]
  );
  return rows[0] ?? null;
}

async function findMenuItemByTreinamentoSlug(slug) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id FROM menu_items
     WHERE url IN (?, ?)
     LIMIT 1`,
    [treinamentoMenuUrl(slug), `${TREINAMENTOS_URL}/${slug}`]
  );
  return rows[0] ?? null;
}

async function findMenuItemByPaginaId(paginaId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT m.id FROM menu_items m
     INNER JOIN documentos_paginas p
       ON m.url COLLATE utf8mb4_general_ci = CONCAT('/documentos/', p.slug) COLLATE utf8mb4_general_ci
     WHERE p.id = ?
     LIMIT 1`,
    [paginaId]
  );
  return rows[0] ?? null;
}

async function findMenuItemTreinamentoByPaginaId(paginaId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT m.id FROM menu_items m
     INNER JOIN documentos_paginas p ON (
       m.url COLLATE utf8mb4_general_ci = CONCAT('/documentos/', p.slug, '?cat=treinamentos') COLLATE utf8mb4_general_ci
       OR m.url COLLATE utf8mb4_general_ci = CONCAT('/treinamentos/', p.slug) COLLATE utf8mb4_general_ci
     )
     WHERE p.id = ?
     LIMIT 1`,
    [paginaId]
  );
  return rows[0] ?? null;
}

function parsePaginaSlugFromMenuUrl(url) {
  if (!url || !url.startsWith(`${DOCUMENTOS_URL}/`)) return null;
  const slug = url.slice(DOCUMENTOS_URL.length + 1);
  return slug || null;
}

function parseTreinamentoSlugFromMenuUrl(url) {
  if (!url) return null;
  const legacy = url.startsWith(`${TREINAMENTOS_URL}/`)
    ? url.slice(TREINAMENTOS_URL.length + 1)
    : null;
  if (legacy) return legacy || null;

  const docMatch = url.match(/^\/documentos\/([a-z0-9-]+)(\?|$)/);
  if (docMatch && url.includes('cat=treinamentos')) {
    return docMatch[1];
  }
  return null;
}

function isTreinamentoMenuUrl(url) {
  if (!url) return false;
  if (url.startsWith(`${TREINAMENTOS_URL}/`)) return true;
  return /^\/documentos\/[a-z0-9-]+\?cat=treinamentos/.test(url);
}

async function upsertMenuItemForPagina(pagina, parentId) {
  const existing =
    (await findMenuItemByPaginaId(pagina.id)) || (await findMenuItemByPaginaSlug(pagina.slug));

  const ordemBase = (pagina.ordem ?? 0) * 2;

  const payload = {
    label: pagina.nome,
    url: paginaMenuUrl(pagina.slug),
    parent_id: parentId,
    abrir_nova_aba: false,
    ativo: pagina.ativo !== false,
    ordem: ordemBase,
  };

  if (existing) {
    await menuRepo.update(existing.id, payload);
  } else {
    await menuRepo.create(payload);
  }

  await upsertTreinamentoMenuItemForPagina(pagina, parentId, ordemBase + 1);
}

async function upsertTreinamentoMenuItemForPagina(pagina, parentId, ordem) {
  const existing =
    (await findMenuItemTreinamentoByPaginaId(pagina.id)) ||
    (await findMenuItemByTreinamentoSlug(pagina.slug));

  const payload = {
    label: treinamentoMenuLabel(pagina),
    url: treinamentoMenuUrl(pagina.slug),
    parent_id: parentId,
    abrir_nova_aba: false,
    ativo: pagina.ativo !== false,
    ordem,
  };

  if (existing) {
    await menuRepo.update(existing.id, payload);
    return;
  }

  await menuRepo.create(payload);
}

async function syncOnCreate(pagina) {
  const parentId = await ensureDocumentosMenuParent();
  await upsertMenuItemForPagina(pagina, parentId);
}

async function syncOnUpdate(before, after) {
  const menuItem =
    (await findMenuItemByPaginaId(after.id)) ||
    (before.slug !== after.slug ? await findMenuItemByPaginaSlug(before.slug) : null);

  const treinItem =
    (await findMenuItemTreinamentoByPaginaId(after.id)) ||
    (before.slug !== after.slug ? await findMenuItemByTreinamentoSlug(before.slug) : null);

  const parentId = await ensureDocumentosMenuParent();
  const ordemBase = (after.ordem ?? 0) * 2;

  if (menuItem) {
    const updatePayload = {
      label: after.nome,
      url: paginaMenuUrl(after.slug),
      parent_id: parentId,
      abrir_nova_aba: false,
      ativo: after.ativo !== false,
      ordem: ordemBase,
    };
    if (before.ordem !== after.ordem) {
      updatePayload.ordem = ordemBase;
    }
    await menuRepo.update(menuItem.id, updatePayload);
  } else {
    await upsertMenuItemForPagina(after, parentId);
    return;
  }

  if (treinItem) {
    await menuRepo.update(treinItem.id, {
      label: treinamentoMenuLabel(after),
      url: treinamentoMenuUrl(after.slug),
      parent_id: parentId,
      abrir_nova_aba: false,
      ativo: after.ativo !== false,
      ordem: ordemBase + 1,
    });
  } else {
    await upsertTreinamentoMenuItemForPagina(after, parentId, ordemBase + 1);
  }
}

async function syncOnDelete(pagina) {
  const menuItem =
    (await findMenuItemByPaginaId(pagina.id)) || (await findMenuItemByPaginaSlug(pagina.slug));

  if (menuItem) {
    await menuRepo.remove(menuItem.id);
  }

  const treinItem =
    (await findMenuItemTreinamentoByPaginaId(pagina.id)) ||
    (await findMenuItemByTreinamentoSlug(pagina.slug));

  if (treinItem) {
    await menuRepo.remove(treinItem.id);
  }
}

async function reconcileAll() {
  const parentId = await ensureDocumentosMenuParent();
  const paginas = await paginaRepo.findAll();

  for (const pagina of paginas) {
    await upsertMenuItemForPagina(pagina, parentId);
  }

  const validDocUrls = new Set(paginas.map((p) => paginaMenuUrl(p.slug)));
  const validTreinUrls = new Set(paginas.map((p) => treinamentoMenuUrl(p.slug)));

  const pool = getPool();
  const [children] = await pool.execute(
    'SELECT id, url, label FROM menu_items WHERE parent_id = ?',
    [parentId]
  );

  for (const item of children) {
    const url = item.url || '';
    const isDocPaginaUrl = url.startsWith(`${DOCUMENTOS_URL}/`) && !isTreinamentoMenuUrl(url);
    const isTreinPaginaUrl = isTreinamentoMenuUrl(url);
    const isDuplicateParentLink = url === DOCUMENTOS_URL;
    const isOrphanDoc = isDocPaginaUrl && !validDocUrls.has(url.split('?')[0]);
    const treinSlug = parseTreinamentoSlugFromMenuUrl(url);
    const isOrphanTrein =
      isTreinPaginaUrl && (!treinSlug || !validTreinUrls.has(treinamentoMenuUrl(treinSlug)));
    if (isOrphanDoc || isOrphanTrein || isDuplicateParentLink) {
      await menuRepo.remove(item.id);
    }
  }

  return paginas.length;
}

async function syncMenuOrdemToPaginas(menuReorderItems) {
  for (const item of menuReorderItems) {
    const menuItem = await menuRepo.findById(Number(item.id));
    if (!menuItem) continue;

    const docSlug = parsePaginaSlugFromMenuUrl(menuItem.url);
    const treinSlug = parseTreinamentoSlugFromMenuUrl(menuItem.url);
    const slug = docSlug || treinSlug;
    if (!slug) continue;

    const pagina = await paginaRepo.findBySlug(slug);
    if (!pagina) continue;

    const ordemMenu = Number(item.ordem);
    if (docSlug) {
      await paginaRepo.update(pagina.id, { ordem: Math.floor(ordemMenu / 2) });
    }
  }
}

async function syncPaginasOrdemToMenu(paginaReorderItems) {
  const parentId = await findDocumentosMenuParent();
  if (!parentId) return;

  for (const item of paginaReorderItems) {
    const pagina = await paginaRepo.findById(Number(item.id));
    if (!pagina) continue;

    const ordemBase = (pagina.ordem ?? 0) * 2;

    const menuItem = await findMenuItemByPaginaId(pagina.id);
    if (menuItem) {
      await menuRepo.update(menuItem.id, { ordem: ordemBase });
    }

    const treinItem = await findMenuItemTreinamentoByPaginaId(pagina.id);
    if (treinItem) {
      await menuRepo.update(treinItem.id, { ordem: ordemBase + 1 });
    }
  }
}

module.exports = {
  DOCUMENTOS_URL,
  TREINAMENTOS_URL,
  paginaMenuUrl,
  treinamentoMenuUrl,
  ensureDocumentosMenuParent,
  findDocumentosMenuParent,
  syncOnCreate,
  syncOnUpdate,
  syncOnDelete,
  reconcileAll,
  syncMenuOrdemToPaginas,
  syncPaginasOrdemToMenu,
};
