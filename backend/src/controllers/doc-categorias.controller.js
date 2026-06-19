const { getPool } = require('../db/pool');
const catRepo = require('../repositories/categorias-documentos.repository');
const { slugify, uniqueSlug } = require('../utils/slug.util');
const menuSync = require('../services/doc-categoria-menu.sync');

async function validateParent(parentId, selfId = null) {
  if (parentId == null || parentId === '') return null;
  const pid = Number(parentId);
  if (selfId != null && pid === selfId) {
    throw new Error('Categoria não pode ser pai de si mesma.');
  }
  const parent = await catRepo.findById(pid);
  if (!parent) {
    throw new Error('Categoria pai não encontrada.');
  }
  if (selfId != null && (await catRepo.isDescendant(selfId, pid))) {
    throw new Error('Categoria não pode ser pai de um descendente.');
  }
  return pid;
}

function parseBody(body) {
  return {
    nome: body.nome?.trim(),
    descricao: body.descricao?.trim() || null,
    icone: body.icone?.trim() || null,
    parent_id: body.parent_id === '' || body.parent_id == null ? null : Number(body.parent_id),
    ordem: body.ordem != null ? Number(body.ordem) : 0,
    ativo: body.ativo !== false,
  };
}

async function getPublicTree(_req, res) {
  const rows = await catRepo.findAllFlat(true);
  const tree = catRepo.buildTree(rows, { filterActive: true, includeRootCounts: true });
  return res.json(tree);
}

async function getAdminTree(_req, res) {
  const rows = await catRepo.findAllFlat(true);
  const tree = catRepo.buildTree(rows, { includeAdminFields: true });
  return res.json(tree);
}

async function create(req, res) {
  try {
    const data = parseBody(req.body);
    if (!data.nome) {
      return res.status(400).json({ mensagem: 'nome é obrigatório.' });
    }
    data.parent_id = await validateParent(data.parent_id);
    const pool = getPool();
    const baseSlug = slugify(data.nome);
    data.slug = await uniqueSlug(pool, baseSlug);
    const item = await catRepo.create(data);
    await menuSync.syncOnCreate(item);
    return res.status(201).json(item);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensagem: 'Slug já existe.' });
    }
    return res.status(400).json({ mensagem: err.message });
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
    if (req.body.parent_id !== undefined) {
      data.parent_id = await validateParent(data.parent_id, id);
    } else {
      data.parent_id = existing.parent_id;
    }

    const pool = getPool();
    if (req.body.nome !== undefined && req.body.nome.trim() !== existing.nome) {
      data.slug = await uniqueSlug(pool, slugify(data.nome), id);
    } else {
      data.slug = existing.slug;
    }

    const item = await catRepo.update(id, data);
    await menuSync.syncOnUpdate(existing, item);
    return res.json(item);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensagem: 'Slug já existe.' });
    }
    return res.status(400).json({ mensagem: err.message });
  }
}

async function remove(req, res) {
  const id = Number(req.params.id);
  const existing = await catRepo.findById(id);
  if (!existing) {
    return res.status(404).json({ mensagem: 'Categoria não encontrada.' });
  }
  await catRepo.remove(id);
  await menuSync.syncOnDelete(existing);
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

    await catRepo.reorderBatch(
      items.map((i) => ({
        id: Number(i.id),
        parent_id: i.parent_id == null ? null : Number(i.parent_id),
        ordem: Number(i.ordem),
      }))
    );
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ mensagem: err.message });
  }
}

module.exports = { getPublicTree, getAdminTree, create, update, remove, reorder };
