const { getPool } = require('../db/pool');
const setorRepo = require('../repositories/documentos-setores.repository');
const { slugify, uniqueEntitySlug } = require('../utils/slug.util');
const contentVersionService = require('../services/content-version.service');

function parseBody(body) {
  return {
    nome: body.nome?.trim(),
    cor: body.cor?.trim() || null,
    ordem: body.ordem != null ? Number(body.ordem) : 0,
    ativo: body.ativo !== false,
  };
}

async function listPublic(_req, res) {
  const setores = await setorRepo.findAll({ ativoOnly: true });
  return res.json(setores);
}

async function listAdmin(_req, res) {
  const setores = await setorRepo.findAll();
  return res.json(setores);
}

async function create(req, res) {
  try {
    const data = parseBody(req.body);
    if (!data.nome) {
      return res.status(400).json({ mensagem: 'nome é obrigatório.' });
    }
    const pool = getPool();
    const baseSlug = slugify(req.body.slug?.trim() || data.nome);
    data.slug = await uniqueEntitySlug(pool, 'documentos_setores', baseSlug);
    const item = await setorRepo.create(data);
    await contentVersionService.bump('documentos');
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
    const existing = await setorRepo.findById(id);
    if (!existing) {
      return res.status(404).json({ mensagem: 'Setor não encontrado.' });
    }

    const data = parseBody({ ...existing, ...req.body });
    if (!data.nome) {
      return res.status(400).json({ mensagem: 'nome é obrigatório.' });
    }

    const pool = getPool();
    if (req.body.slug !== undefined && req.body.slug.trim() !== existing.slug) {
      data.slug = await uniqueEntitySlug(pool, 'documentos_setores', slugify(req.body.slug.trim()), id);
    } else {
      data.slug = existing.slug;
    }

    const item = await setorRepo.update(id, data);
    await contentVersionService.bump('documentos');
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
  const existing = await setorRepo.findById(id);
  if (!existing) {
    return res.status(404).json({ mensagem: 'Setor não encontrado.' });
  }
  await setorRepo.remove(id);
  await contentVersionService.bump('documentos');
  return res.json({ ok: true });
}

module.exports = { listPublic, listAdmin, create, update, remove };
