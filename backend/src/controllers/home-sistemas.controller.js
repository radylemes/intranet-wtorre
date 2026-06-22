const siteConfigRepo = require('../repositories/site-config.repository');
const contentVersionService = require('../services/content-version.service');

function validarUrl(url) {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('/')) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const err = new Error('URL deve ser interna (começar com /) ou externa (http:// ou https://).');
  err.status = 400;
  throw err;
}

function validarHomeSistemas(body) {
  if (!body || typeof body !== 'object') {
    const err = new Error('Configuração inválida.');
    err.status = 400;
    throw err;
  }

  if (!Array.isArray(body.itens)) {
    const err = new Error('Lista de sistemas é obrigatória.');
    err.status = 400;
    throw err;
  }

  for (const item of body.itens) {
    if (!item?.nome?.trim()) {
      const err = new Error('Nome do sistema é obrigatório.');
      err.status = 400;
      throw err;
    }
    if (!item?.subtitulo?.trim()) {
      const err = new Error(`Subtítulo do sistema "${item.nome}" é obrigatório.`);
      err.status = 400;
      throw err;
    }
    if (item.url?.trim()) {
      item.url = validarUrl(item.url);
    } else {
      item.url = null;
    }
  }

  if (body.linkTodos?.trim()) {
    body.linkTodos = validarUrl(body.linkTodos);
  } else {
    body.linkTodos = null;
  }

  return body;
}

async function getSistemas(_req, res) {
  try {
    const config = await siteConfigRepo.getHomeSistemas();
    return res.json(config);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function putSistemas(req, res) {
  try {
    const validado = validarHomeSistemas(req.body);
    const config = await siteConfigRepo.setHomeSistemas(validado);
    await contentVersionService.bump('menu');
    return res.json(config);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

module.exports = {
  getSistemas,
  putSistemas,
};
