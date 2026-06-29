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

function exibirMenuTreinamento(pagina) {
  return !!pagina.exibir_menu_treinamento;
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
  if (isTreinamentoMenuUrl(url)) return null;
  const slug = url.slice(DOCUMENTOS_URL.length + 1).split('?')[0];
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

async function removeTreinamentoMenuItem(pagina) {
  const treinItem =
    (await findMenuItemTreinamentoByPaginaId(pagina.id)) ||
    (await findMenuItemByTreinamentoSlug(pagina.slug));

  if (treinItem) {
    await menuRepo.remove(treinItem.id);
  }
}

async function upsertTreinamentoMenuItemForPagina(pagina, parentId) {
  const existing =
    (await findMenuItemTreinamentoByPaginaId(pagina.id)) ||
    (await findMenuItemByTreinamentoSlug(pagina.slug));

  const payload = {
    label: treinamentoMenuLabel(pagina),
    url: treinamentoMenuUrl(pagina.slug),
    parent_id: parentId,
    abrir_nova_aba: false,
    ativo: pagina.ativo !== false,
  };

  if (existing) {
    await menuRepo.update(existing.id, payload);
    return;
  }

  await menuRepo.create(payload);
}

async function assignMenuOrdens(parentId) {
  const paginas = await paginaRepo.findAll();
  paginas.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.id - b.id);

  let menuOrdem = 0;
  for (const pagina of paginas) {
    const menuItem =
      (await findMenuItemByPaginaId(pagina.id)) || (await findMenuItemByPaginaSlug(pagina.slug));
    if (menuItem) {
      await menuRepo.update(menuItem.id, { ordem: menuOrdem++ });
    }

    if (exibirMenuTreinamento(pagina)) {
      const treinItem =
        (await findMenuItemTreinamentoByPaginaId(pagina.id)) ||
        (await findMenuItemByTreinamentoSlug(pagina.slug));
      if (treinItem) {
        await menuRepo.update(treinItem.id, { ordem: menuOrdem++ });
      }
    }
  }
}

async function upsertMenuItemForPagina(pagina, parentId) {
  const existing =
    (await findMenuItemByPaginaId(pagina.id)) || (await findMenuItemByPaginaSlug(pagina.slug));

  const payload = {
    label: pagina.nome,
    url: paginaMenuUrl(pagina.slug),
    parent_id: parentId,
    abrir_nova_aba: false,
    ativo: pagina.ativo !== false,
  };

  if (existing) {
    await menuRepo.update(existing.id, payload);
  } else {
    await menuRepo.create(payload);
  }

  if (exibirMenuTreinamento(pagina)) {
    await upsertTreinamentoMenuItemForPagina(pagina, parentId);
  } else {
    await removeTreinamentoMenuItem(pagina);
  }
}

async function syncOnCreate(pagina) {
  const parentId = await ensureDocumentosMenuParent();
  await upsertMenuItemForPagina(pagina, parentId);
  await assignMenuOrdens(parentId);
}

async function syncOnUpdate(before, after) {
  const menuItem =
    (await findMenuItemByPaginaId(after.id)) ||
    (before.slug !== after.slug ? await findMenuItemByPaginaSlug(before.slug) : null);

  const parentId = await ensureDocumentosMenuParent();

  if (menuItem) {
    await menuRepo.update(menuItem.id, {
      label: after.nome,
      url: paginaMenuUrl(after.slug),
      parent_id: parentId,
      abrir_nova_aba: false,
      ativo: after.ativo !== false,
    });
  } else {
    await upsertMenuItemForPagina(after, parentId);
    await assignMenuOrdens(parentId);
    return;
  }

  if (exibirMenuTreinamento(after)) {
    const treinItem =
      (await findMenuItemTreinamentoByPaginaId(after.id)) ||
      (before.slug !== after.slug ? await findMenuItemByTreinamentoSlug(before.slug) : null);

    if (treinItem) {
      await menuRepo.update(treinItem.id, {
        label: treinamentoMenuLabel(after),
        url: treinamentoMenuUrl(after.slug),
        parent_id: parentId,
        abrir_nova_aba: false,
        ativo: after.ativo !== false,
      });
    } else {
      await upsertTreinamentoMenuItemForPagina(after, parentId);
    }
  } else {
    await removeTreinamentoMenuItem(after);
  }

  await assignMenuOrdens(parentId);
}

async function syncOnDelete(pagina) {
  const menuItem =
    (await findMenuItemByPaginaId(pagina.id)) || (await findMenuItemByPaginaSlug(pagina.slug));

  if (menuItem) {
    await menuRepo.remove(menuItem.id);
  }

  await removeTreinamentoMenuItem(pagina);
}

async function reconcileAll() {
  const parentId = await ensureDocumentosMenuParent();
  const paginas = await paginaRepo.findAll();

  for (const pagina of paginas) {
    await upsertMenuItemForPagina(pagina, parentId);
  }

  await assignMenuOrdens(parentId);

  const validDocUrls = new Set(paginas.map((p) => paginaMenuUrl(p.slug)));
  const validTreinUrls = new Set(
    paginas.filter((p) => exibirMenuTreinamento(p)).map((p) => treinamentoMenuUrl(p.slug))
  );

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
  const docItems = [];

  for (const item of menuReorderItems) {
    const menuItem = await menuRepo.findById(Number(item.id));
    if (!menuItem) continue;

    const docSlug = parsePaginaSlugFromMenuUrl(menuItem.url);
    if (!docSlug) continue;

    docItems.push({
      slug: docSlug,
      ordem: Number(item.ordem),
    });
  }

  docItems.sort((a, b) => a.ordem - b.ordem);

  for (let index = 0; index < docItems.length; index++) {
    const pagina = await paginaRepo.findBySlug(docItems[index].slug);
    if (!pagina) continue;
    await paginaRepo.update(pagina.id, { ordem: index });
  }

  const parentId = await findDocumentosMenuParent();
  if (parentId) {
    await assignMenuOrdens(parentId);
  }
}

async function syncPaginasOrdemToMenu(paginaReorderItems) {
  const parentId = await findDocumentosMenuParent();
  if (!parentId) return;

  for (const item of paginaReorderItems) {
    const pagina = await paginaRepo.findById(Number(item.id));
    if (!pagina) continue;
    await paginaRepo.update(pagina.id, { ordem: Number(item.ordem) });
  }

  await assignMenuOrdens(parentId);
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
