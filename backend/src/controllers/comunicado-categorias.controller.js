const catRepo = require('../repositories/comunicado-categorias.repository');
const contentVersionService = require('../services/content-version.service');

const COR_REGEX = /^#[0-9A-Fa-f]{6}$/;

function handleError(res, err) {
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ mensagem: 'Já existe uma categoria com este identificador.' });
  }
  return res.status(err.status || 500).json({
    mensagem: err.message || 'Erro ao processar categoria.',
  });
}

function parsePayload(body, { parcial = false } = {}) {
  const nome = body.nome != null ? String(body.nome).trim() : undefined;
  const cor = body.cor != null ? String(body.cor).trim() : undefined;

  if (!parcial || nome !== undefined) {
    if (!nome) {
      const err = new Error('Nome é obrigatório.');
      err.status = 400;
      throw err;
    }
    if (nome.length > 120) {
      const err = new Error('Nome deve ter no máximo 120 caracteres.');
      err.status = 400;
      throw err;
    }
  }

  if (!parcial || cor !== undefined) {
    if (!cor || !COR_REGEX.test(cor)) {
      const err = new Error('Cor inválida. Use o formato #RRGGBB.');
      err.status = 400;
      throw err;
    }
  }

  let ordem = body.ordem;
  if (ordem === '' || ordem === null || ordem === undefined) {
    ordem = 0;
  } else {
    ordem = Number(ordem);
    if (!Number.isFinite(ordem)) {
      const err = new Error('Ordem deve ser um número.');
      err.status = 400;
      throw err;
    }
  }

  const ativo = body.ativo === undefined ? true : Boolean(body.ativo);

  return { nome, cor: cor?.toLowerCase(), ordem, ativo };
}

async function listarPublicas(_req, res) {
  try {
    const lista = await catRepo.listar({ apenasAtivas: true });
    return res.json(lista);
  } catch (err) {
    return handleError(res, err);
  }
}

async function listarAdmin(_req, res) {
  try {
    const lista = await catRepo.listar();
    return res.json(lista);
  } catch (err) {
    return handleError(res, err);
  }
}

async function obter(req, res) {
  try {
    const id = Number(req.params.catId);
    const item = await catRepo.buscarPorId(id);
    if (!item) {
      return res.status(404).json({ mensagem: 'Categoria não encontrada.' });
    }
    return res.json(item);
  } catch (err) {
    return handleError(res, err);
  }
}

async function criar(req, res) {
  try {
    const data = parsePayload(req.body);
    const item = await catRepo.criar(data);
    await contentVersionService.bump('comunicados');
    return res.status(201).json(item);
  } catch (err) {
    return handleError(res, err);
  }
}

async function atualizar(req, res) {
  try {
    const id = Number(req.params.catId);
    const existing = await catRepo.buscarPorId(id);
    if (!existing) {
      return res.status(404).json({ mensagem: 'Categoria não encontrada.' });
    }

    const partial = parsePayload(req.body, { parcial: true });
    const data = {
      nome: partial.nome ?? existing.nome,
      cor: partial.cor ?? existing.cor,
      ordem: partial.ordem !== undefined ? partial.ordem : existing.ordem,
      ativo: req.body.ativo !== undefined ? partial.ativo : existing.ativo,
    };

    const item = await catRepo.atualizar(id, data);
    await contentVersionService.bump('comunicados');
    return res.json(item);
  } catch (err) {
    return handleError(res, err);
  }
}

async function remover(req, res) {
  try {
    const id = Number(req.params.catId);
    const existing = await catRepo.buscarPorId(id);
    if (!existing) {
      return res.status(404).json({ mensagem: 'Categoria não encontrada.' });
    }

    const total = await catRepo.contarComunicados(id);
    if (total > 0) {
      return res.status(409).json({
        mensagem: `Não é possível excluir: ${total} comunicado(s) usam esta categoria.`,
      });
    }

    await catRepo.remover(id);
    await contentVersionService.bump('comunicados');
    return res.json({ ok: true });
  } catch (err) {
    return handleError(res, err);
  }
}

module.exports = {
  listarPublicas,
  listarAdmin,
  obter,
  criar,
  atualizar,
  remover,
};
