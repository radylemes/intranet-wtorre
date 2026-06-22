const fs = require('fs');
const catRepo = require('../repositories/categorias-documentos.repository');
const docRepo = require('../repositories/documentos.repository');
const contentVersionService = require('../services/content-version.service');
const {
  validateUploadFile,
  isPreviewable,
  resolveStoragePath,
  sanitizeFilename,
} = require('../utils/documentos.validation');

async function list(req, res) {
  const categoriaRef = req.query.categoria;
  if (!categoriaRef) {
    return res.status(400).json({ mensagem: 'Parâmetro categoria é obrigatório.' });
  }

  const categoriaId = await docRepo.resolveCategoriaId(categoriaRef);
  if (!categoriaId) {
    return res.status(404).json({ mensagem: 'Categoria não encontrada.' });
  }

  const categoria = await catRepo.findById(categoriaId);
  if (!categoria || !categoria.ativo) {
    return res.status(404).json({ mensagem: 'Categoria não encontrada.' });
  }

  const documentos = await docRepo.findByCategoria(categoriaId, { ativoOnly: true });
  return res.json(documentos);
}

async function upload(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ mensagem: 'Arquivo é obrigatório.' });
    }

    const validation = validateUploadFile(req.file);
    if (!validation.ok) {
      if (req.file.path) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ mensagem: validation.mensagem });
    }

    const categoriaId = Number(req.body.categoria_id);
    const titulo = req.body.titulo?.trim();
    const descricao = req.body.descricao?.trim() || null;

    if (!categoriaId || !titulo) {
      if (req.file.path) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ mensagem: 'categoria_id e titulo são obrigatórios.' });
    }

    const categoria = await catRepo.findById(categoriaId);
    if (!categoria) {
      if (req.file.path) fs.unlink(req.file.path, () => {});
      return res.status(404).json({ mensagem: 'Categoria não encontrada.' });
    }

    const doc = await docRepo.create({
      categoria_id: categoriaId,
      titulo,
      descricao,
      nome_original: req.file.originalname,
      arquivo_path: req.file.filename,
      mime: req.file.mimetype,
      extensao: validation.ext,
      tamanho_bytes: req.file.size,
      criado_por: req.user.id,
    });

    await contentVersionService.bump('documentos');
    return res.status(201).json(doc);
  } catch (err) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ mensagem: err.message });
  }
}

async function update(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await docRepo.findById(id);
    if (!existing) {
      return res.status(404).json({ mensagem: 'Documento não encontrado.' });
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
    if (req.body.categoria_id !== undefined) {
      const categoriaId = Number(req.body.categoria_id);
      const categoria = await catRepo.findById(categoriaId);
      if (!categoria) {
        return res.status(404).json({ mensagem: 'Categoria não encontrada.' });
      }
      data.categoria_id = categoriaId;
    }

    const doc = await docRepo.update(id, data);
    await contentVersionService.bump('documentos');
    return res.json(doc);
  } catch (err) {
    return res.status(400).json({ mensagem: err.message });
  }
}

async function remove(req, res) {
  const id = Number(req.params.id);
  const existing = await docRepo.findById(id);
  if (!existing) {
    return res.status(404).json({ mensagem: 'Documento não encontrado.' });
  }

  try {
    const filePath = resolveStoragePath(existing.arquivo_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (_err) {
    // ignora erro de arquivo ausente
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

module.exports = { list, upload, update, remove, view, download };
