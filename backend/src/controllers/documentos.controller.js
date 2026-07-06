const fs = require('fs');
const catRepo = require('../repositories/categorias-documentos.repository');
const docRepo = require('../repositories/documentos.repository');
const docEntidadesRepo = require('../repositories/documento-entidades.repository');
const paginaRepo = require('../repositories/documentos-paginas.repository');
const contentVersionService = require('../services/content-version.service');
const { resolveVisibilidadesFromBody } = require('../utils/visibilidade-entidades.validation');
const { validateSetorId } = require('../utils/documentos-setor.validation');
const { unlinkArquivo } = require('../utils/documentos-arquivos.util');
const {
  resolveThumbPath,
  unlinkThumbnail,
} = require('../utils/documentos-thumbnail.util');
const {
  validateUploadFile,
  isPreviewable,
  resolveStoragePath,
  sanitizeFilename,
} = require('../utils/documentos.validation');

const THUMB_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

function unlinkSafe(filePath) {
  if (!filePath) return;
  try {
    fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
}

async function list(req, res) {
  const categoriaRef = req.query.categoria;
  const paginaSlug = req.query.pagina?.trim();
  if (!categoriaRef) {
    return res.status(400).json({ mensagem: 'Parâmetro categoria é obrigatório.' });
  }
  if (!paginaSlug) {
    return res.status(400).json({ mensagem: 'Parâmetro pagina é obrigatório.' });
  }

  const pagina = await paginaRepo.findBySlug(paginaSlug);
  if (!pagina || !pagina.ativo) {
    return res.status(404).json({ mensagem: 'Entidade não encontrada.' });
  }

  const categoriaId = await docRepo.resolveCategoriaId(categoriaRef, pagina.id);
  if (!categoriaId) {
    return res.status(404).json({ mensagem: 'Categoria não encontrada.' });
  }

  const categoria = await catRepo.findById(categoriaId);
  if (!categoria || !categoria.ativo) {
    return res.status(404).json({ mensagem: 'Categoria não encontrada.' });
  }

  let setorFilter = { type: 'all' };
  if (req.query.setor !== undefined && req.query.setor !== '') {
    const resolved = await docRepo.resolveSetorFilter(req.query.setor);
    if (resolved === null) {
      return res.status(404).json({ mensagem: 'Setor não encontrado.' });
    }
    setorFilter = resolved;
  }

  const documentos = await docRepo.findByPaginaCategoria(pagina.id, categoriaId, {
    ativoOnly: true,
    setorFilter,
  });
  const visMap = await docEntidadesRepo.findByDocumentoIds(documentos.map((d) => d.id));
  return res.json(
    documentos.map((d) => ({
      ...d,
      visibilidades: visMap.get(d.id) ?? [],
    }))
  );
}

async function upload(req, res) {
  const arquivoFile = req.files?.arquivo?.[0] || req.file;
  const thumbFile = req.files?.thumb?.[0];

  try {
    if (!arquivoFile) {
      return res.status(400).json({ mensagem: 'Arquivo é obrigatório.' });
    }

    const validation = validateUploadFile(arquivoFile);
    if (!validation.ok) {
      unlinkSafe(arquivoFile.path);
      unlinkSafe(thumbFile?.path);
      return res.status(400).json({ mensagem: validation.mensagem });
    }

    const categoriaId = Number(req.body.categoria_id);
    const titulo = req.body.titulo?.trim();
    const descricao = req.body.descricao?.trim() || null;

    if (!titulo) {
      unlinkSafe(arquivoFile.path);
      unlinkSafe(thumbFile?.path);
      return res.status(400).json({ mensagem: 'titulo é obrigatório.' });
    }

    let visibilidades;
    try {
      const categoria = categoriaId ? await catRepo.findById(categoriaId) : null;
      visibilidades = await resolveVisibilidadesFromBody(
        req.body,
        categoria?.pagina_id,
        categoriaId || null
      );
    } catch (err) {
      unlinkSafe(arquivoFile.path);
      unlinkSafe(thumbFile?.path);
      return res.status(err.status || 400).json({ mensagem: err.message });
    }

    if (!categoriaId && !visibilidades.length) {
      unlinkSafe(arquivoFile.path);
      unlinkSafe(thumbFile?.path);
      return res.status(400).json({ mensagem: 'Informe visibilidades ou categoria_id.' });
    }

    let setorId;
    try {
      setorId = await validateSetorId(req.body.setor_id);
    } catch (err) {
      unlinkSafe(arquivoFile.path);
      unlinkSafe(thumbFile?.path);
      return res.status(err.status || 400).json({ mensagem: err.message });
    }

    const primaryCategoriaId = visibilidades[0].categoria_id;

    const doc = await docRepo.create({
      categoria_id: primaryCategoriaId,
      titulo,
      descricao,
      thumbnail_path: thumbFile?.filename ?? null,
      nome_original: arquivoFile.originalname,
      arquivo_path: arquivoFile.filename,
      mime: arquivoFile.mimetype,
      extensao: validation.ext,
      tamanho_bytes: arquivoFile.size,
      criado_por: req.user.id,
      setor_id: setorId,
      destaque:
        req.body.destaque === 'true' || req.body.destaque === true || req.body.destaque === '1',
      destaque_ordem: req.body.destaque_ordem != null ? Number(req.body.destaque_ordem) : 0,
    });

    await docEntidadesRepo.replaceForDocumento(doc.id, visibilidades);
    const vis = await docEntidadesRepo.findByDocumentoId(doc.id);

    await contentVersionService.bump('documentos');
    return res.status(201).json({ ...doc, visibilidades: vis });
  } catch (err) {
    unlinkSafe(arquivoFile?.path);
    unlinkSafe(thumbFile?.path);
    return res.status(400).json({ mensagem: err.message });
  }
}

async function update(req, res) {
  const arquivoFile = req.files?.arquivo?.[0];
  const thumbFile = req.files?.thumb?.[0];

  try {
    const id = Number(req.params.id);
    const existing = await docRepo.findById(id);
    if (!existing) {
      unlinkSafe(arquivoFile?.path);
      if (thumbFile?.path) unlinkSafe(thumbFile.path);
      return res.status(404).json({ mensagem: 'Documento não encontrado.' });
    }

    const data = {};

    if (arquivoFile) {
      const validation = validateUploadFile(arquivoFile);
      if (!validation.ok) {
        unlinkSafe(arquivoFile.path);
        unlinkSafe(thumbFile?.path);
        return res.status(400).json({ mensagem: validation.mensagem });
      }
      unlinkArquivo(existing.arquivo_path);
      data.nome_original = arquivoFile.originalname;
      data.arquivo_path = arquivoFile.filename;
      data.mime = arquivoFile.mimetype;
      data.extensao = validation.ext;
      data.tamanho_bytes = arquivoFile.size;
    }
    if (req.body.titulo !== undefined) {
      const titulo = req.body.titulo?.trim();
      if (!titulo) return res.status(400).json({ mensagem: 'titulo é obrigatório.' });
      data.titulo = titulo;
    }
    if (req.body.descricao !== undefined) {
      data.descricao = req.body.descricao?.trim() || null;
    }
    if (req.body.destaque !== undefined) {
      data.destaque =
        req.body.destaque === 'true' || req.body.destaque === true || req.body.destaque === '1';
    }
    if (req.body.destaque_ordem !== undefined) {
      data.destaque_ordem = Number(req.body.destaque_ordem) || 0;
    }

    if (req.body.remover_thumb === 'true' || req.body.remover_thumb === true) {
      if (existing.thumbnail_path) {
        unlinkThumbnail(existing.thumbnail_path);
      }
      data.thumbnail_path = null;
    }

    if (thumbFile) {
      if (existing.thumbnail_path) {
        unlinkThumbnail(existing.thumbnail_path);
      }
      data.thumbnail_path = thumbFile.filename;
    }

    if (req.body.setor_id !== undefined) {
      data.setor_id = await validateSetorId(req.body.setor_id);
    }

    if (req.body.categoria_id !== undefined || req.body.visibilidades !== undefined) {
      let visibilidades;
      try {
        const legacyCatId =
          req.body.categoria_id !== undefined ? Number(req.body.categoria_id) : existing.categoria_id;
        const legacyCat = legacyCatId ? await catRepo.findById(legacyCatId) : null;
        visibilidades = await resolveVisibilidadesFromBody(
          req.body,
          legacyCat?.pagina_id,
          legacyCatId || null
        );
      } catch (err) {
        unlinkSafe(arquivoFile?.path);
        if (thumbFile?.path) unlinkSafe(thumbFile.path);
        return res.status(err.status || 400).json({ mensagem: err.message });
      }
      data.categoria_id = visibilidades[0].categoria_id;
      await docRepo.update(id, data);
      await docEntidadesRepo.replaceForDocumento(id, visibilidades);
      const doc = await docRepo.findById(id);
      const vis = await docEntidadesRepo.findByDocumentoId(id);
      await contentVersionService.bump('documentos');
      return res.json({ ...doc, visibilidades: vis });
    }

    if (existing.setor_id == null && Object.keys(data).length === 0) {
      return res.status(400).json({ mensagem: 'setor_id é obrigatório.' });
    }

    if (Object.keys(data).length) {
      await docRepo.update(id, data);
    }

    const doc = await docRepo.findById(id);
    await contentVersionService.bump('documentos');
    return res.json(doc);
  } catch (err) {
    unlinkSafe(arquivoFile?.path);
    if (thumbFile?.path) unlinkSafe(thumbFile.path);
    return res.status(err.status || 400).json({ mensagem: err.message });
  }
}

async function remove(req, res) {
  const id = Number(req.params.id);
  const existing = await docRepo.findById(id);
  if (!existing) {
    return res.status(404).json({ mensagem: 'Documento não encontrado.' });
  }

  unlinkArquivo(existing.arquivo_path);
  if (existing.thumbnail_path) {
    unlinkThumbnail(existing.thumbnail_path);
  }

  await docRepo.remove(id);
  await contentVersionService.bump('documentos');
  return res.json({ ok: true });
}

function streamFile(req, res, doc, disposition) {
  if (!doc.ativo) {
    return res.status(404).json({ mensagem: 'Documento não encontrado.' });
  }
  if (doc.mime === 'text/html') {
    return res.status(403).json({ mensagem: 'Tipo de arquivo não permitido.' });
  }

  let filePath;
  try {
    filePath = resolveStoragePath(doc.arquivo_path);
  } catch (_err) {
    return res.status(404).json({ mensagem: 'Arquivo não encontrado.' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ mensagem: 'Arquivo não encontrado no disco.' });
  }

  const filename = sanitizeFilename(doc.nome_original);
  res.setHeader('Content-Type', doc.mime);
  res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.status(500).json({ mensagem: 'Erro ao ler arquivo.' });
    }
  });
  stream.pipe(res);
}

async function serveThumb(req, res) {
  const filename = req.params.filename;
  let filePath;
  try {
    filePath = resolveThumbPath(filename);
  } catch (err) {
    return res.status(err.status || 400).json({ mensagem: err.message });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ mensagem: 'Thumbnail não encontrada.' });
  }

  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  res.setHeader('Content-Type', THUMB_MIME[ext] || 'image/jpeg');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.status(500).json({ mensagem: 'Erro ao ler thumbnail.' });
    }
  });
  stream.pipe(res);
}

async function thumbStream(req, res) {
  const id = Number(req.params.id);
  const doc = await docRepo.findById(id);
  if (!doc?.thumbnail_path) {
    return res.status(404).json({ mensagem: 'Thumbnail não encontrada.' });
  }

  req.params.filename = doc.thumbnail_path;
  return serveThumb(req, res);
}

async function view(req, res) {
  const id = Number(req.params.id);
  const doc = await docRepo.findById(id);
  if (!doc) {
    return res.status(404).json({ mensagem: 'Documento não encontrado.' });
  }

  const disposition = isPreviewable(doc.mime) ? 'inline' : 'attachment';
  return streamFile(req, res, doc, disposition);
}

async function download(req, res) {
  const id = Number(req.params.id);
  const doc = await docRepo.findById(id);
  if (!doc) {
    return res.status(404).json({ mensagem: 'Documento não encontrado.' });
  }
  return streamFile(req, res, doc, 'attachment');
}

module.exports = { list, upload, update, remove, view, download, serveThumb, thumbStream };
