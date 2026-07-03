const { getPool } = require('../db/pool');
const catRepo = require('../repositories/categorias-documentos.repository');
const paginaRepo = require('../repositories/documentos-paginas.repository');
const { slugify, uniqueSlug } = require('../utils/slug.util');
const { normalizarIconePersistido, validarIconeEntrada } = require('../utils/doc-icone.util');
const contentVersionService = require('../services/content-version.service');
const { unlinkArquivos } = require('../utils/documentos-arquivos.util');

async function validateParent(parentId, paginaId, selfId = null) {
  if (parentId == null || parentId === '') return null;
  const pid = Number(parentId);
  if (selfId != null && pid === selfId) {
    throw new Error('Categoria não pode ser pai de si mesma.');
  }
  const parent = await catRepo.findById(pid);
  if (!parent) {
    throw new Error('Categoria pai não encontrada.');
  }
  if (parent.pagina_id !== paginaId) {
    throw new Error('Categoria pai deve pertencer à mesma página.');
  }
  if (selfId != null && (await catRepo.isDescendant(selfId, pid))) {
    throw new Error('Categoria não pode ser pai de um descendente.');
  }
  return pid;
}

function parseBody(body) {
  const iconeRaw = body.icone?.trim() || null;
  if (!validarIconeEntrada(iconeRaw)) {
    const err = new Error('Ícone inválido. Use lucide:nome, brand:slug ou material:estilo:nome.');
    err.status = 400;
    throw err;
  }

  return {
    nome: body.nome?.trim(),
    descricao: body.descricao?.trim() || null,
    icone: normalizarIconePersistido(iconeRaw),
    parent_id: body.parent_id === '' || body.parent_id == null ? null : Number(body.parent_id),
    pagina_id: body.pagina_id != null ? Number(body.pagina_id) : undefined,
    ordem: body.ordem != null ? Number(body.ordem) : 0,
    ativo: body.ativo !== false,
  };
}

async function getPublicTree(_req, res) {
  const rows = await catRepo.findAllFlat({ includeCounts: true });
  const tree = catRepo.buildTree(rows, { filterActive: true, includeRootCounts: true });
  return res.json(tree);
}

async function getTreeByPagina(req, res) {
  const pagina = await paginaRepo.findBySlug(req.params.paginaSlug);
  if (!pagina || !pagina.ativo) {
    return res.status(404).json({ mensagem: 'Página não encontrada.' });
  }
  const rows = await catRepo.findAllFlat({ includeCounts: true, paginaId: pagina.id });
  const tree = catRepo.buildTree(rows, { filterActive: true, includeRootCounts: true });
  return res.json(tree);
}

async function getAdminTree(req, res) {
  const paginaId = req.query.pagina_id != null ? Number(req.query.pagina_id) : null;
  if (!paginaId) {
    return res.status(400).json({ mensagem: 'pagina_id é obrigatório.' });
  }
  const pagina = await paginaRepo.findById(paginaId);
  if (!pagina) {
    return res.status(404).json({ mensagem: 'Página não encontrada.' });
  }
  const rows = await catRepo.findAllFlat({ includeCounts: true, paginaId });
  const tree = catRepo.buildTree(rows, { includeAdminFields: true });
  return res.json(tree);
}

/** @deprecated Legado — redirect de URLs antigas sem paginaSlug. */
async function resolveLegacySlug(req, res) {
  const slug = req.params.slug;
  const matches = await catRepo.findAllBySlugLegacy(slug);
  if (!matches.length) {
    return res.status(404).json({ mensagem: 'Categoria não encontrada.' });
  }
  const categoria = matches[0];
  const pagina = categoria.pagina_id ? await paginaRepo.findById(categoria.pagina_id) : null;
  if (!pagina) {
    return res.status(404).json({ mensagem: 'Página da categoria não encontrada.' });
  }

  let root = categoria;
  while (root.parent_id) {
    root = await catRepo.findById(root.parent_id);
  }

  const isRoot = categoria.parent_id == null;
  return res.json({
    pagina_slug: pagina.slug,
    categoria_slug: isRoot ? categoria.slug : root.slug,
    sub_slug: isRoot ? null : categoria.slug,
    categoria_id: categoria.id,
  });
}

async function create(req, res) {
  try {
    const data = parseBody(req.body);
    if (!data.nome) {
      return res.status(400).json({ mensagem: 'nome é obrigatório.' });
    }
    if (!data.pagina_id) {
      return res.status(400).json({ mensagem: 'pagina_id é obrigatório.' });
    }
    const pagina = await paginaRepo.findById(data.pagina_id);
    if (!pagina) {
      return res.status(404).json({ mensagem: 'Página não encontrada.' });
    }
    data.parent_id = await validateParent(data.parent_id, data.pagina_id);
    const pool = getPool();
    const baseSlug = slugify(data.nome);
    data.slug = await uniqueSlug(pool, baseSlug, null, data.pagina_id);
    const item = await catRepo.create(data);
    await contentVersionService.bump('documentos');
    return res.status(201).json(item);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensagem: 'Slug já existe nesta página.' });
    }
    return res.status(err.status || 400).json({ mensagem: err.message });
  }
}

async function update(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await catRepo.findById(id);
    if (!existing) {
      return res.status(404).json({ mensagem: 'Categoria não encontrada.' });
    }

    const data = parseBody({ ...existing, ...req.body });
    if (!data.nome) {
      return res.status(400).json({ mensagem: 'nome é obrigatório.' });
    }
    data.pagina_id = existing.pagina_id;
    if (req.body.parent_id !== undefined) {
      data.parent_id = await validateParent(data.parent_id, existing.pagina_id, id);
    } else {
      data.parent_id = existing.parent_id;
    }

    const pool = getPool();
    if (req.body.nome !== undefined && req.body.nome.trim() !== existing.nome) {
      data.slug = await uniqueSlug(pool, slugify(data.nome), id, existing.pagina_id);
    } else {
      data.slug = existing.slug;
    }

    const item = await catRepo.update(id, data);
    await contentVersionService.bump('documentos');
    return res.json(item);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensagem: 'Slug já existe nesta página.' });
    }
    return res.status(err.status || 400).json({ mensagem: err.message });
  }
}

async function remove(req, res) {
  const id = Number(req.params.id);
  const existing = await catRepo.findById(id);
  if (!existing) {
    return res.status(404).json({ mensagem: 'Categoria não encontrada.' });
  }

  const arquivos = await catRepo.findArquivoPathsByCategoriaSubtree(id);
  unlinkArquivos(arquivos);

  await catRepo.remove(id);
  await contentVersionService.bump('documentos');
  return res.json({ ok: true });
}

async function reorder(req, res) {
  try {
    const items = req.body;
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ mensagem: 'Envie um array de { id, parent_id, ordem }.' });
    }

    for (const item of items) {
      if (!item.id || item.ordem == null) {
        return res.status(400).json({ mensagem: 'Cada item precisa de id e ordem.' });
      }
      const existing = await catRepo.findById(Number(item.id));
      if (!existing) {
        return res.status(400).json({ mensagem: `Categoria ${item.id} não encontrada.` });
      }
      const sentParent = item.parent_id == null ? null : Number(item.parent_id);
      const currentParent = existing.parent_id == null ? null : Number(existing.parent_id);
      if (sentParent !== currentParent) {
        return res.status(400).json({
          mensagem: 'Reordenação não pode alterar a categoria pai. Use o formulário de edição.',
        });
      }
    }

    const normalized = items.map((i) => ({
      id: Number(i.id),
      parent_id: i.parent_id == null ? null : Number(i.parent_id),
      ordem: Number(i.ordem),
    }));

    await catRepo.reorderBatch(normalized);
    await contentVersionService.bump('documentos');
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ mensagem: err.message });
  }
}

module.exports = {
  getPublicTree,
  getTreeByPagina,
  getAdminTree,
  resolveLegacySlug,
  create,
  update,
  remove,
  reorder,
};
