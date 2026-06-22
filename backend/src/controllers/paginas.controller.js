const paginasRepo = require('../repositories/paginas.repository');
const paginasService = require('../services/paginas.service');
const contentVersionService = require('../services/content-version.service');
const blobService = require('../services/blob.service');
const { env } = require('../config/env');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { IMAGE_MIMES } = require('../config/paginas-upload');
const { processPaginaImagem } = require('../services/paginas-imagem.service');

function criadoPor(req) {
  return req.user?.id || null;
}

function handleError(res, err) {
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ mensagem: 'Já existe uma página com este slug.' });
  }
  return res.status(err.status || 500).json({
    mensagem: err.message || 'Erro ao processar página.',
  });
}

async function listarPublicadas(_req, res) {
  try {
    const lista = await paginasRepo.listarPublicadas();
    return res.json(lista);
  } catch (err) {
    return handleError(res, err);
  }
}

async function buscarPorSlug(req, res) {
  try {
    const slug = String(req.params.slug || '').trim();
    if (!slug) {
      return res.status(400).json({ mensagem: 'Slug é obrigatório.' });
    }
    const pagina = await paginasRepo.buscarPorSlug(slug);
    if (!pagina) {
      return res.status(404).json({ mensagem: 'Página não encontrada.' });
    }
    return res.json(pagina);
  } catch (err) {
    return handleError(res, err);
  }
}

async function listar(req, res) {
  try {
    const status = req.query.status;
    const busca = req.query.busca;
    const lista = await paginasRepo.listar({ status, busca });
    return res.json(lista);
  } catch (err) {
    return handleError(res, err);
  }
}

async function obter(req, res) {
  try {
    const id = Number(req.params.id);
    const pagina = await paginasRepo.buscarPorId(id);
    if (!pagina) {
      return res.status(404).json({ mensagem: 'Página não encontrada.' });
    }
    return res.json(pagina);
  } catch (err) {
    return handleError(res, err);
  }
}

async function criar(req, res) {
  try {
    const data = await paginasService.prepararCriacao(req.body, criadoPor(req));
    const pagina = await paginasRepo.criar(data);
    await contentVersionService.bump('paginas');
    return res.status(201).json(pagina);
  } catch (err) {
    return handleError(res, err);
  }
}

async function atualizar(req, res) {
  try {
    const id = Number(req.params.id);
    const data = await paginasService.prepararAtualizacao(id, req.body);
    const pagina = await paginasRepo.atualizar(id, data);
    await contentVersionService.bump('paginas');
    return res.json(pagina);
  } catch (err) {
    return handleError(res, err);
  }
}

async function remover(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await paginasRepo.buscarPorId(id);
    if (!existing) {
      return res.status(404).json({ mensagem: 'Página não encontrada.' });
    }
    await paginasRepo.remover(id);
    await contentVersionService.bump('paginas');
    return res.json({ ok: true });
  } catch (err) {
    return handleError(res, err);
  }
}

async function unlinkSafe(filePath) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {
    /* ignore */
  }
}

async function uploadImagem(req, res) {
  let tmpPath = null;
  let processedPath = null;
  let blobName = null;
  const container = env.paginasImagensContainer;

  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ mensagem: 'Nenhuma imagem enviada.' });
    }

    tmpPath = file.path;

    if (!IMAGE_MIMES.has(file.mimetype)) {
      return res.status(400).json({ mensagem: 'Tipo de imagem não permitido. Use JPG, PNG, WebP ou GIF.' });
    }

    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ext === '.svg') {
      return res.status(400).json({ mensagem: 'SVG não é permitido.' });
    }

    await blobService.garantirContainerLeituraPublica(container);

    const processed = await processPaginaImagem(tmpPath, file.originalname);
    processedPath = processed.outputPath;

    blobName = `${crypto.randomUUID()}${processed.ext}`;
    await blobService.enviarArquivo(container, processedPath, blobName, processed.contentType);

    const url = blobService.urlBlobPublico(container, blobName);
    return res.status(201).json({ url });
  } catch (err) {
    if (blobName) {
      try {
        await blobService.removerBlob(container, blobName);
      } catch {
        /* ignore */
      }
    }
    return handleError(res, err);
  } finally {
    await unlinkSafe(tmpPath);
    if (processedPath && processedPath !== tmpPath) {
      await unlinkSafe(processedPath);
    }
  }
}

module.exports = {
  listarPublicadas,
  buscarPorSlug,
  listar,
  obter,
  criar,
  atualizar,
  remover,
  uploadImagem,
};
