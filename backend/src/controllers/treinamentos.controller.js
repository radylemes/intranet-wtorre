const fs = require('fs/promises');
const treinamentosRepo = require('../repositories/treinamentos.repository');
const containersRepo = require('../repositories/storage-containers.repository');
const paginaRepo = require('../repositories/documentos-paginas.repository');
const catRepo = require('../repositories/categorias-documentos.repository');
const blobService = require('../services/blob.service');
const contentVersionService = require('../services/content-version.service');
const {
  parseDuracaoSeg,
  parseCategoriaId,
  parsePaginaId,
} = require('../utils/treinamento-categoria.validation');

function criadoPor(req) {
  return req.user?.nome_completo || req.user?.nome || req.user?.email || null;
}

async function unlinkSafe(filePath) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {
    /* ignore */
  }
}

async function validarPaginaAtiva(paginaId) {
  const pagina = await paginaRepo.findById(paginaId);
  if (!pagina || !pagina.ativo) {
    const err = new Error('Página (entidade) inválida ou inativa.');
    err.status = 400;
    throw err;
  }
  return pagina;
}

async function validarCategoriaParaPagina(categoriaId, paginaId) {
  if (categoriaId == null) return null;
  const cat = await catRepo.findById(categoriaId);
  if (!cat || !cat.ativo) {
    const err = new Error('Categoria inválida ou inativa.');
    err.status = 400;
    throw err;
  }
  if (cat.pagina_id !== paginaId) {
    const err = new Error('Categoria deve pertencer à mesma entidade do treinamento.');
    err.status = 400;
    throw err;
  }
  return cat;
}

function parseListOptions(req) {
  const pagina = req.query.pagina?.trim() || req.params.paginaSlug?.trim() || 'wtorre';
  const categoria = req.query.categoria?.trim() || null;
  const semCategoria =
    req.query.sem_categoria === '1' ||
    req.query.sem_categoria === 'true' ||
    categoria === '__sem__';
  return {
    paginaSlug: pagina,
    categoriaSlug: semCategoria ? null : categoria,
    semCategoria,
  };
}

async function listar(req, res) {
  try {
    const opts = parseListOptions(req);
    const lista = await treinamentosRepo.findAllPublico(opts);
    return res.json(lista);
  } catch (err) {
    return res.status(500).json({ mensagem: err.message || 'Erro ao listar treinamentos.' });
  }
}

async function listarPorPagina(req, res) {
  return listar(req, res);
}

async function listarAdmin(req, res) {
  try {
    const paginaId = req.query.pagina_id != null ? Number(req.query.pagina_id) : null;
    const lista = await treinamentosRepo.findAllAdmin({
      paginaId: paginaId && Number.isFinite(paginaId) ? paginaId : null,
    });
    return res.json(lista);
  } catch (err) {
    return res.status(500).json({ mensagem: err.message || 'Erro ao listar treinamentos.' });
  }
}

async function obter(req, res) {
  try {
    const id = Number(req.params.id);
    const row = await treinamentosRepo.findById(id);
    if (!row || (!row.ativo && req.user?.perfil !== 'ADMIN')) {
      return res.status(404).json({ mensagem: 'Treinamento não encontrado.' });
    }

    if (req.user?.perfil === 'ADMIN') {
      return res.json(row);
    }
    return res.json(treinamentosRepo.mapPublico(row));
  } catch (err) {
    return res.status(500).json({ mensagem: err.message || 'Erro ao obter treinamento.' });
  }
}

async function playback(req, res) {
  try {
    const id = Number(req.params.id);
    const row = await treinamentosRepo.findById(id);
    if (!row || !row.ativo) {
      return res.status(404).json({ mensagem: 'Treinamento não encontrado.' });
    }

    const sas = await blobService.gerarSasLeitura(row.container, row.blob_name);
    return res.json(sas);
  } catch (err) {
    return res.status(err.status || 500).json({
      mensagem: err.message || 'Erro ao gerar URL de playback.',
    });
  }
}

async function thumb(req, res) {
  try {
    const id = Number(req.params.id);
    const row = await treinamentosRepo.findById(id);
    if (!row || !row.ativo || !row.thumb_blob) {
      return res.status(404).json({ mensagem: 'Thumbnail não encontrada.' });
    }

    const sas = await blobService.gerarSasLeitura(row.container, row.thumb_blob);
    return res.json(sas);
  } catch (err) {
    return res.status(err.status || 500).json({
      mensagem: err.message || 'Erro ao gerar URL da thumbnail.',
    });
  }
}

async function resolverContainer(nomeForm) {
  if (nomeForm?.trim()) {
    const c = await containersRepo.findByNome(nomeForm.trim().toLowerCase());
    if (!c || !c.ativo) {
      const err = new Error('Container inválido ou inativo.');
      err.status = 400;
      throw err;
    }
    return c.nome;
  }
  const padrao = await containersRepo.containerPadrao();
  if (!padrao) {
    const err = new Error('Nenhum container padrão configurado.');
    err.status = 400;
    throw err;
  }
  return padrao.nome;
}

async function criar(req, res) {
  const videoFile = req.files?.video?.[0];
  const thumbFile = req.files?.thumb?.[0];
  let uploadedVideo = null;
  let uploadedThumb = null;
  let container = null;

  try {
    if (!videoFile) {
      return res.status(400).json({ mensagem: 'Arquivo de vídeo é obrigatório.' });
    }

    const titulo = req.body.titulo?.trim();
    if (!titulo) {
      return res.status(400).json({ mensagem: 'titulo é obrigatório.' });
    }

    const paginaId = parsePaginaId(req.body);
    await validarPaginaAtiva(paginaId);
    let categoriaId = null;
    if (req.body.categoria_id !== undefined || req.body.categoriaId !== undefined) {
      categoriaId = parseCategoriaId(req.body);
    }
    await validarCategoriaParaPagina(categoriaId, paginaId);

    container = await resolverContainer(req.body.container);
    await blobService.garantirContainer(container);

    const videoBlobName = blobService.novoBlobName(videoFile.originalname);
    await blobService.enviarArquivo(
      container,
      videoFile.path,
      videoBlobName,
      videoFile.mimetype
    );
    uploadedVideo = { container, blobName: videoBlobName };

    let thumbBlobName = null;
    if (thumbFile) {
      thumbBlobName = blobService.novoBlobName(thumbFile.originalname);
      await blobService.enviarArquivo(
        container,
        thumbFile.path,
        thumbBlobName,
        thumbFile.mimetype
      );
      uploadedThumb = { container, blobName: thumbBlobName };
    }

    const treinamento = await treinamentosRepo.criar({
      titulo,
      descricao: req.body.descricao?.trim() || null,
      pagina_id: paginaId,
      categoria_id: categoriaId ?? null,
      area: req.body.area?.trim() || null,
      duracao_seg: parseDuracaoSeg(req.body.duracao_seg),
      container,
      blob_name: videoBlobName,
      thumb_blob: thumbBlobName,
      destaque: req.body.destaque === 'true' || req.body.destaque === true || req.body.destaque === '1',
      ordem: req.body.ordem ? Number(req.body.ordem) : null,
      criado_por: criadoPor(req),
    });

    await contentVersionService.bump('treinamentos');
    return res.status(201).json(treinamento);
  } catch (err) {
    if (uploadedVideo) {
      await blobService.removerBlob(uploadedVideo.container, uploadedVideo.blobName).catch(() => {});
    }
    if (uploadedThumb) {
      await blobService.removerBlob(uploadedThumb.container, uploadedThumb.blobName).catch(() => {});
    }
    console.error('[treinamentos.criar]', err.code || err.name, err.message);
    return res.status(err.status || 500).json({
      mensagem: err.message || 'Erro ao criar treinamento.',
    });
  } finally {
    await unlinkSafe(videoFile?.path);
    await unlinkSafe(thumbFile?.path);
  }
}

async function atualizar(req, res) {
  const videoFile = req.files?.video?.[0];
  const thumbFile = req.files?.thumb?.[0];
  let uploadedVideo = null;
  let uploadedThumb = null;

  try {
    const id = Number(req.params.id);
    const existing = await treinamentosRepo.findById(id);
    if (!existing) {
      return res.status(404).json({ mensagem: 'Treinamento não encontrado.' });
    }

    const data = {};
    if (req.body.titulo !== undefined) {
      const titulo = req.body.titulo?.trim();
      if (!titulo) return res.status(400).json({ mensagem: 'titulo é obrigatório.' });
      data.titulo = titulo;
    }
    if (req.body.descricao !== undefined) {
      data.descricao = req.body.descricao?.trim() || null;
    }

    let paginaId = existing.pagina_id;
    if (req.body.pagina_id !== undefined || req.body.paginaId !== undefined) {
      paginaId = parsePaginaId(req.body);
      await validarPaginaAtiva(paginaId);
      data.pagina_id = paginaId;
    }

    if (req.body.categoria_id !== undefined || req.body.categoriaId !== undefined) {
      const categoriaId = parseCategoriaId(req.body);
      await validarCategoriaParaPagina(categoriaId ?? null, paginaId);
      data.categoria_id = categoriaId ?? null;
    } else if (data.pagina_id !== undefined && data.pagina_id !== existing.pagina_id) {
      if (existing.categoria_id != null) {
        const cat = await catRepo.findById(existing.categoria_id);
        if (!cat || cat.pagina_id !== paginaId) {
          data.categoria_id = null;
        }
      }
    }

    if (req.body.area !== undefined) {
      data.area = req.body.area?.trim() || null;
    }
    if (req.body.duracao_seg !== undefined) {
      data.duracao_seg = parseDuracaoSeg(req.body.duracao_seg);
    }
    if (req.body.destaque !== undefined) {
      data.destaque =
        req.body.destaque === 'true' || req.body.destaque === true || req.body.destaque === '1';
    }
    if (req.body.ordem !== undefined) {
      data.ordem = req.body.ordem === '' || req.body.ordem == null ? null : Number(req.body.ordem);
    }
    if (req.body.ativo !== undefined) {
      data.ativo = req.body.ativo === 'true' || req.body.ativo === true || req.body.ativo === '1';
    }

    let container = existing.container;
    if (req.body.container !== undefined && req.body.container?.trim()) {
      container = await resolverContainer(req.body.container);
      data.container = container;
    }

    const oldVideo = existing.blob_name;
    const oldThumb = existing.thumb_blob;

    if (videoFile) {
      await blobService.garantirContainer(container);
      const videoBlobName = blobService.novoBlobName(videoFile.originalname);
      await blobService.enviarArquivo(
        container,
        videoFile.path,
        videoBlobName,
        videoFile.mimetype
      );
      uploadedVideo = { container, blobName: videoBlobName };
      data.blob_name = videoBlobName;
    }

    if (thumbFile) {
      await blobService.garantirContainer(container);
      const thumbBlobName = blobService.novoBlobName(thumbFile.originalname);
      await blobService.enviarArquivo(
        container,
        thumbFile.path,
        thumbBlobName,
        thumbFile.mimetype
      );
      uploadedThumb = { container, blobName: thumbBlobName };
      data.thumb_blob = thumbBlobName;
    }

    const updated = await treinamentosRepo.atualizar(id, data);

    if (uploadedVideo && oldVideo && oldVideo !== uploadedVideo.blobName) {
      await blobService.removerBlob(existing.container, oldVideo);
    }
    if (uploadedThumb && oldThumb && oldThumb !== uploadedThumb.blobName) {
      await blobService.removerBlob(existing.container, oldThumb);
    }

    await contentVersionService.bump('treinamentos');
    return res.json(updated);
  } catch (err) {
    if (uploadedVideo) {
      await blobService.removerBlob(uploadedVideo.container, uploadedVideo.blobName);
    }
    if (uploadedThumb) {
      await blobService.removerBlob(uploadedThumb.container, uploadedThumb.blobName);
    }
    return res.status(err.status || 500).json({
      mensagem: err.message || 'Erro ao atualizar treinamento.',
    });
  } finally {
    await unlinkSafe(videoFile?.path);
    await unlinkSafe(thumbFile?.path);
  }
}

async function excluir(req, res) {
  try {
    const id = Number(req.params.id);
    const removed = await treinamentosRepo.remover(id);
    if (!removed) {
      return res.status(404).json({ mensagem: 'Treinamento não encontrado.' });
    }

    await blobService.removerBlob(removed.container, removed.blob_name);
    if (removed.thumb_blob) {
      await blobService.removerBlob(removed.container, removed.thumb_blob);
    }

    await contentVersionService.bump('treinamentos');
    return res.json({ ok: true });
  } catch (err) {
    return res.status(err.status || 500).json({
      mensagem: err.message || 'Erro ao excluir treinamento.',
    });
  }
}

module.exports = {
  listar,
  listarPorPagina,
  listarAdmin,
  obter,
  playback,
  thumb,
  criar,
  atualizar,
  excluir,
};
