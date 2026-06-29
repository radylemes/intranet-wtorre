const fs = require('fs');
const path = require('path');
const { getPool } = require('../db/pool');
const paginaRepo = require('../repositories/documentos-paginas.repository');
const catRepo = require('../repositories/categorias-documentos.repository');
const { slugify, uniqueEntitySlug } = require('../utils/slug.util');
const menuSync = require('../services/doc-pagina-menu.sync');
const contentVersionService = require('../services/content-version.service');
const { unlinkArquivos } = require('../utils/documentos-arquivos.util');
const { processLogoImage } = require('../services/grupo-logos-image.service');
const { env } = require('../config/env');
const { ensureDocumentosPaginasLogosDir } = require('../config/documentos-paginas-logo-upload');
const {
  STORED_URL_PREFIX,
  cleanupOrphanPaginaLogo,
} = require('../utils/documentos-paginas-logo.util');

function parseBody(body) {
  return {
    nome: body.nome?.trim(),
    descricao: body.descricao?.trim() || null,
    logo_url: body.logo_url?.trim() || null,
    ordem: body.ordem != null ? Number(body.ordem) : 0,
    ativo: body.ativo !== false,
    exibir_menu_treinamento: body.exibir_menu_treinamento === true,
  };
}

async function listPublic(_req, res) {
  const paginas = await paginaRepo.findAll({ ativoOnly: true });
  return res.json(paginas);
}

async function listAdmin(_req, res) {
  const paginas = await paginaRepo.findAll();
  return res.json(paginas);
}

async function create(req, res) {
  try {
    const data = parseBody(req.body);
    if (!data.nome) {
      return res.status(400).json({ mensagem: 'nome é obrigatório.' });
    }
    const pool = getPool();
    const baseSlug = slugify(req.body.slug?.trim() || data.nome);
    data.slug = await uniqueEntitySlug(pool, 'documentos_paginas', baseSlug);
    const item = await paginaRepo.create(data);
    await menuSync.syncOnCreate(item);
    await contentVersionService.bumpMany(['documentos', 'menu']);
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
    const existing = await paginaRepo.findById(id);
    if (!existing) {
      return res.status(404).json({ mensagem: 'Página não encontrada.' });
    }

    const data = parseBody({ ...existing, ...req.body });
    if (!data.nome) {
      return res.status(400).json({ mensagem: 'nome é obrigatório.' });
    }

    const pool = getPool();
    if (req.body.slug !== undefined && req.body.slug.trim() !== existing.slug) {
      data.slug = await uniqueEntitySlug(pool, 'documentos_paginas', slugify(req.body.slug.trim()), id);
    } else if (req.body.nome !== undefined && req.body.nome.trim() !== existing.nome && req.body.slug === undefined) {
      data.slug = existing.slug;
    } else {
      data.slug = existing.slug;
    }

    const item = await paginaRepo.update(id, data);

    if (existing.logo_url && existing.logo_url !== item.logo_url) {
      await cleanupOrphanPaginaLogo(existing.logo_url, paginaRepo);
    }

    await menuSync.syncOnUpdate(existing, item);
    await contentVersionService.bumpMany(['documentos', 'menu']);
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
  const existing = await paginaRepo.findById(id);
  if (!existing) {
    return res.status(404).json({ mensagem: 'Página não encontrada.' });
  }

  const arquivos = await catRepo.findArquivoPathsByPaginaId(id);
  unlinkArquivos(arquivos);

  if (existing.logo_url) {
    await cleanupOrphanPaginaLogo(existing.logo_url, paginaRepo, id);
  }

  await paginaRepo.remove(id);
  await menuSync.syncOnDelete(existing);
  await contentVersionService.bumpMany(['documentos', 'menu']);
  return res.json({ ok: true });
}

async function uploadLogo(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ mensagem: 'Arquivo de imagem é obrigatório.' });
    }

    const inputPath = req.file.path;
    const { outputPath, compactado, largura, altura } = await processLogoImage(
      inputPath,
      req.file.originalname
    );

    const filename = path.basename(outputPath);
    const url = `${STORED_URL_PREFIX}${filename}`;

    return res.json({
      url,
      compactado,
      largura,
      altura,
    });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function serveLogoFile(req, res) {
  try {
    ensureDocumentosPaginasLogosDir();
    const filename = path.basename(req.params.filename || '');
    if (!filename || filename.includes('..')) {
      return res.status(400).json({ mensagem: 'Arquivo inválido.' });
    }

    const filePath = path.join(env.documentosPaginasLogosDir, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ mensagem: 'Arquivo não encontrado.' });
    }

    res.set('Cache-Control', 'public, max-age=86400');
    return res.sendFile(filePath);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

module.exports = {
  listPublic,
  listAdmin,
  create,
  update,
  remove,
  uploadLogo,
  serveLogoFile,
};
