const { getPool } = require('../db/pool');
const menuRepo = require('../repositories/menu.repository');
const catRepo = require('../repositories/categorias-documentos.repository');

const DOCUMENTOS_URL = '/documentos';

function categoriaMenuUrl(slug) {
  return `${DOCUMENTOS_URL}/${slug}`;
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

async function findMenuItemByCategoriaSlug(slug) {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT id FROM menu_items WHERE url = ? LIMIT 1',
    [categoriaMenuUrl(slug)]
  );
  return rows[0] ?? null;
}

async function findMenuItemByCategoriaId(categoriaId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT m.id FROM menu_items m
     INNER JOIN categorias_documentos c ON m.url = CONCAT('/documentos/', c.slug)
     WHERE c.id = ?
     LIMIT 1`,
    [categoriaId]
  );
  return rows[0] ?? null;
}

function isRootCategoria(categoria) {
  return categoria.parent_id == null;
}

async function upsertMenuItemForCategoria(categoria, parentId) {
  const existing =
    (await findMenuItemByCategoriaId(categoria.id)) ||
    (await findMenuItemByCategoriaSlug(categoria.slug));

  const payload = {
    label: categoria.nome,
    url: categoriaMenuUrl(categoria.slug),
    parent_id: parentId,
    ordem: categoria.ordem ?? 0,
    abrir_nova_aba: false,
    ativo: categoria.ativo !== false,
  };

  if (existing) {
    await menuRepo.update(existing.id, payload);
    return;
  }

  await menuRepo.create(payload);
}

async function syncOnCreate(categoria) {
  if (!isRootCategoria(categoria)) return;

  const parentId = await ensureDocumentosMenuParent();
  await upsertMenuItemForCategoria(categoria, parentId);
}

async function syncOnUpdate(before, after) {
  const wasRoot = isRootCategoria(before);
  const isRoot = isRootCategoria(after);

  if (wasRoot && !isRoot) {
    const menuItem = await findMenuItemByCategoriaId(before.id);
    if (menuItem) await menuRepo.remove(menuItem.id);
    return;
  }

  if (!wasRoot && isRoot) {
    await syncOnCreate(after);
    return;
  }

  if (!isRoot) return;

  const menuItem =
    (await findMenuItemByCategoriaId(after.id)) ||
    (before.slug !== after.slug ? await findMenuItemByCategoriaSlug(before.slug) : null);

  const parentId = await ensureDocumentosMenuParent();

  if (menuItem) {
    await menuRepo.update(menuItem.id, {
      label: after.nome,
      url: categoriaMenuUrl(after.slug),
      parent_id: parentId,
      ordem: after.ordem ?? 0,
      abrir_nova_aba: false,
      ativo: after.ativo !== false,
    });
    return;
  }

  await upsertMenuItemForCategoria(after, parentId);
}

async function syncOnDelete(categoria) {
  if (!isRootCategoria(categoria)) return;

  const menuItem =
    (await findMenuItemByCategoriaId(categoria.id)) ||
    (await findMenuItemByCategoriaSlug(categoria.slug));

  if (menuItem) {
    await menuRepo.remove(menuItem.id);
  }
}

async function reconcileAll() {
  const parentId = await ensureDocumentosMenuParent();
  const rows = await catRepo.findAllFlat();
  const rootCategories = rows.filter((c) => c.parent_id == null);

  for (const categoria of rootCategories) {
    await upsertMenuItemForCategoria(categoria, parentId);
  }

  const pool = getPool();
  const validUrls = new Set(rootCategories.map((c) => categoriaMenuUrl(c.slug)));
  const [children] = await pool.execute(
    'SELECT id, url, label FROM menu_items WHERE parent_id = ?',
    [parentId]
  );

  for (const item of children) {
    const url = item.url || '';
    const isDocCategoryUrl = url.startsWith(`${DOCUMENTOS_URL}/`);
    const isDuplicateParentLink = url === DOCUMENTOS_URL;
    if ((isDocCategoryUrl && !validUrls.has(url)) || isDuplicateParentLink) {
      await menuRepo.remove(item.id);
    }
  }

  return rootCategories.length;
}

module.exports = {
  DOCUMENTOS_URL,
  categoriaMenuUrl,
  ensureDocumentosMenuParent,
  findDocumentosMenuParent,
  findMenuItemByCategoriaSlug,
  syncOnCreate,
  syncOnUpdate,
  syncOnDelete,
  reconcileAll,
};
