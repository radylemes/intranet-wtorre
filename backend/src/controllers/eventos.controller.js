const fontesRepo = require('../repositories/eventos-fontes.repository');
const eventosService = require('../services/eventos/eventos.service');
const parsers = require('../services/eventos/parsers');
const auditRepo = require('../repositories/auditLog.repository');

const CODIGO_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function handleError(res, err) {
  return res.status(err.status || 500).json({
    mensagem: err.message || 'Erro ao processar eventos.',
  });
}

function audit(req, action) {
  return auditRepo.log({
    userId: req.user?.id,
    action,
    email: req.user?.email,
    requestId: req.requestId,
    ip: req.ip,
  });
}

function validarUrl(url) {
  const value = String(url || '').trim();
  if (!value || value.length > 500) {
    const err = new Error('URL inválida (máx. 500 caracteres).');
    err.status = 400;
    throw err;
  }
  if (!/^https?:\/\//i.test(value)) {
    const err = new Error('URL deve começar com http:// ou https://');
    err.status = 400;
    throw err;
  }
  return value;
}

function validarCodigo(codigo) {
  const value = String(codigo || '').trim().toLowerCase();
  if (!value || value.length > 50 || !CODIGO_RE.test(value)) {
    const err = new Error('Código inválido. Use letras minúsculas, números e hífens.');
    err.status = 400;
    throw err;
  }
  return value;
}

function validarLimite(limite) {
  if (limite === null || limite === undefined || limite === '') return null;
  const n = Number(limite);
  if (!Number.isFinite(n) || n < 1 || n > 100) {
    const err = new Error('Limite deve ser entre 1 e 100 ou vazio.');
    err.status = 400;
    throw err;
  }
  return Math.floor(n);
}

function bodyParaFonte(body, { parcial = false, codigoFixo } = {}) {
  const data = {};

  if (!parcial || body.codigo !== undefined) {
    if (codigoFixo) {
      data.codigo = codigoFixo;
    } else {
      data.codigo = validarCodigo(body.codigo);
    }
  }

  if (!parcial || body.nome !== undefined) {
    const nome = String(body.nome || '').trim();
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
    data.nome = nome;
  }

  if (!parcial || body.url !== undefined) {
    data.url = validarUrl(body.url);
  }

  const parserTipo = body.parser_tipo ?? body.parserTipo;
  if (!parcial || parserTipo !== undefined) {
    const tipo = String(parserTipo || '').trim();
    if (!tipo || !parsers.isParserValido(tipo)) {
      const err = new Error('Tipo de parser inválido.');
      err.status = 400;
      throw err;
    }
    data.parserTipo = tipo;
  }

  if (!parcial || body.ordem !== undefined) {
    const ordem = Number(body.ordem ?? 0);
    data.ordem = Number.isFinite(ordem) ? ordem : 0;
  }

  if (!parcial || body.limite !== undefined) {
    data.limite = validarLimite(body.limite);
  }

  if (!parcial || body.ativo !== undefined) {
    data.ativo = body.ativo === true || body.ativo === 1 || body.ativo === '1';
  }

  return data;
}

async function listarProximos(req, res) {
  try {
    const resultado = await eventosService.listarProximos();
    res.json(resultado);
  } catch (err) {
    handleError(res, err);
  }
}

async function listarAgenda(req, res) {
  try {
    const limiteRaw = req.query.limite;
    const limite =
      limiteRaw != null && limiteRaw !== ''
        ? validarLimite(limiteRaw) ?? Number(limiteRaw)
        : undefined;
    const resultado = await eventosService.listarAgenda({ limite });
    res.json(resultado);
  } catch (err) {
    handleError(res, err);
  }
}

async function listarParsers(req, res) {
  try {
    res.json(parsers.listarTipos());
  } catch (err) {
    handleError(res, err);
  }
}

async function listarFontesAdmin(req, res) {
  try {
    const busca = req.query.busca;
    const fontes = await fontesRepo.listarAdmin({ busca });
    res.json(fontes);
  } catch (err) {
    handleError(res, err);
  }
}

async function obterFonte(req, res) {
  try {
    const id = Number(req.params.id);
    const fonte = await fontesRepo.buscarPorId(id);
    if (!fonte) {
      return res.status(404).json({ mensagem: 'Fonte não encontrada.' });
    }
    res.json(fonte);
  } catch (err) {
    handleError(res, err);
  }
}

async function criarFonte(req, res) {
  try {
    const data = bodyParaFonte(req.body);
    data.ativo = req.body.ativo === undefined ? true : data.ativo ?? true;

    const existente = await fontesRepo.buscarPorCodigo(data.codigo);
    if (existente) {
      return res.status(409).json({ mensagem: 'Já existe uma fonte com este código.' });
    }

    const criada = await fontesRepo.criar(data);
    eventosService.invalidarCache();
    await audit(req, 'EVENTOS_FONTE_CRIAR');
    res.status(201).json(criada);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensagem: 'Já existe uma fonte com este código.' });
    }
    handleError(res, err);
  }
}

async function atualizarFonte(req, res) {
  try {
    const id = Number(req.params.id);
    const atual = await fontesRepo.buscarPorId(id);
    if (!atual) {
      return res.status(404).json({ mensagem: 'Fonte não encontrada.' });
    }

    const data = bodyParaFonte(req.body, { parcial: true });
    const atualizada = await fontesRepo.atualizar(id, data);
    eventosService.invalidarCache(atual.codigo);
    if (atualizada?.codigo && atualizada.codigo !== atual.codigo) {
      eventosService.invalidarCache(atualizada.codigo);
    }
    await audit(req, 'EVENTOS_FONTE_ATUALIZAR');
    res.json(atualizada);
  } catch (err) {
    handleError(res, err);
  }
}

async function removerFonte(req, res) {
  try {
    const id = Number(req.params.id);
    const atual = await fontesRepo.buscarPorId(id);
    if (!atual) {
      return res.status(404).json({ mensagem: 'Fonte não encontrada.' });
    }

    await fontesRepo.remover(id);
    eventosService.invalidarCache(atual.codigo);
    await audit(req, 'EVENTOS_FONTE_REMOVER');
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
}

async function testarFonte(req, res) {
  try {
    const id = Number(req.params.id);
    const fonte = await fontesRepo.buscarPorId(id);
    if (!fonte) {
      return res.status(404).json({ mensagem: 'Fonte não encontrada.' });
    }

    const resultado = await eventosService.testarFonte(fonte);
    res.json(resultado);
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  listarProximos,
  listarAgenda,
  listarParsers,
  listarFontesAdmin,
  obterFonte,
  criarFonte,
  atualizarFonte,
  removerFonte,
  testarFonte,
};
