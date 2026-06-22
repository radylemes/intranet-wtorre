const fs = require('fs/promises');
const treinamentosRepo = require('../repositories/treinamentos.repository');
const containersRepo = require('../repositories/storage-containers.repository');
const blobService = require('../services/blob.service');
const contentVersionService = require('../services/content-version.service');
const { validarCategoria, parseDuracaoSeg } = require('../utils/treinamento-categoria.validation');

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

async function listar(req, res) {
  try {
    const lista = await treinamentosRepo.findAllPublico();
    return res.json(lista);
  } catch (err) {
    return res.status(500).json({ mensagem: err.message || 'Erro ao listar treinamentos.' });
  }
}

async function listarAdmin(req, res) {
  try {
    const lista = await treinamentosRepo.findAllAdmin();
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

    const cat = validarCategoria(req.body.categoria);
    if (!cat.ok) return res.status(400).json({ mensagem: cat.mensagem });

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
      categoria: cat.categoria,
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
    if (req.body.categoria !== undefined) {
      const cat = validarCategoria(req.body.categoria);
      if (!cat.ok) return res.status(400).json({ mensagem: cat.mensagem });
      data.categoria = cat.categoria;
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
  listarAdmin,
  obter,
  playback,
  thumb,
  criar,
  atualizar,
  excluir,
};
