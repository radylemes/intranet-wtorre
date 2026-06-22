const comunicadosRepo = require('../repositories/comunicados.repository');
const contentVersionService = require('../services/content-version.service');

const CATEGORIAS_VALIDAS = new Set(['rh', 'ti', 'ev', 'com']);

function criadoPor(req) {
  return req.user?.id || null;
}

function handleError(res, err) {
  return res.status(err.status || 500).json({
    mensagem: err.message || 'Erro ao processar comunicado.',
  });
}

function validarPayload(body, { parcial = false } = {}) {
  const titulo = body.titulo != null ? String(body.titulo).trim() : undefined;
  const categoria = body.categoria != null ? String(body.categoria).trim() : undefined;
  const dataPublicacao =
    body.data_publicacao != null
      ? String(body.data_publicacao).trim()
      : body.dataPublicacao != null
        ? String(body.dataPublicacao).trim()
        : undefined;

  if (!parcial || titulo !== undefined) {
    if (!titulo) {
      const err = new Error('Título é obrigatório.');
      err.status = 400;
      throw err;
    }
    if (titulo.length > 300) {
      const err = new Error('Título deve ter no máximo 300 caracteres.');
      err.status = 400;
      throw err;
    }
  }

  if (!parcial || categoria !== undefined) {
    if (!categoria || !CATEGORIAS_VALIDAS.has(categoria)) {
      const err = new Error('Categoria inválida.');
      err.status = 400;
      throw err;
    }
  }

  if (!parcial || dataPublicacao !== undefined) {
    if (!dataPublicacao || !/^\d{4}-\d{2}-\d{2}$/.test(dataPublicacao)) {
      const err = new Error('Data de publicação inválida. Use o formato AAAA-MM-DD.');
      err.status = 400;
      throw err;
    }
    const [year, month, day] = dataPublicacao.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      const err = new Error('Data de publicação inválida.');
      err.status = 400;
      throw err;
    }
  }

  let ordem = body.ordem;
  if (ordem === '' || ordem === null || ordem === undefined) {
    ordem = null;
  } else {
    ordem = Number(ordem);
    if (!Number.isFinite(ordem)) {
      const err = new Error('Ordem deve ser um número.');
      err.status = 400;
      throw err;
    }
  }

  const ativo = body.ativo === undefined ? true : Boolean(body.ativo);

  return {
    titulo,
    categoria,
    data_publicacao: dataPublicacao,
    ordem,
    ativo,
  };
}

async function listarPublicos(_req, res) {
  try {
    const lista = await comunicadosRepo.listarPublicos();
    return res.json(lista);
  } catch (err) {
    return handleError(res, err);
  }
}

async function listarAdmin(req, res) {
  try {
    const busca = req.query.busca;
    const lista = await comunicadosRepo.listarAdmin({ busca });
    return res.json(lista);
  } catch (err) {
    return handleError(res, err);
  }
}

async function obter(req, res) {
  try {
    const id = Number(req.params.id);
    const item = await comunicadosRepo.buscarPorId(id);
    if (!item) {
      return res.status(404).json({ mensagem: 'Comunicado não encontrado.' });
    }
    return res.json(item);
  } catch (err) {
    return handleError(res, err);
  }
}

async function criar(req, res) {
  try {
    const data = validarPayload(req.body);
    const item = await comunicadosRepo.criar({
      ...data,
      criado_por: criadoPor(req),
    });
    await contentVersionService.bump('comunicados');
    return res.status(201).json(item);
  } catch (err) {
    return handleError(res, err);
  }
}

async function atualizar(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await comunicadosRepo.buscarPorId(id);
    if (!existing) {
      return res.status(404).json({ mensagem: 'Comunicado não encontrado.' });
    }

    const partial = validarPayload(req.body, { parcial: true });
    const data = {
      titulo: partial.titulo ?? existing.titulo,
      categoria: partial.categoria ?? existing.categoria,
      data_publicacao: partial.data_publicacao ?? existing.dataPublicacao,
      ordem: partial.ordem !== undefined ? partial.ordem : existing.ordem,
      ativo: req.body.ativo !== undefined ? partial.ativo : existing.ativo,
    };

    const item = await comunicadosRepo.atualizar(id, data);
    await contentVersionService.bump('comunicados');
    return res.json(item);
  } catch (err) {
    return handleError(res, err);
  }
}

async function remover(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await comunicadosRepo.buscarPorId(id);
    if (!existing) {
      return res.status(404).json({ mensagem: 'Comunicado não encontrado.' });
    }
    await comunicadosRepo.remover(id);
    await contentVersionService.bump('comunicados');
    return res.json({ ok: true });
  } catch (err) {
    return handleError(res, err);
  }
}

module.exports = {
  listarPublicos,
  listarAdmin,
  obter,
  criar,
  atualizar,
  remover,
};
