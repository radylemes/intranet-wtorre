const siteConfigRepo = require('../repositories/site-config.repository');
const { isPaginaInterna } = require('../config/paginas-internas');

function validarUrl(url, tipo_destino) {
  if (!url?.trim()) return null;

  const trimmed = url.trim();

  if (tipo_destino === 'interna') {
    if (!trimmed.startsWith('/')) {
      const err = new Error('Página interna deve começar com /.');
      err.status = 400;
      throw err;
    }
    if (!isPaginaInterna(trimmed)) {
      const err = new Error(`Página interna não reconhecida: ${trimmed}`);
      err.status = 400;
      throw err;
    }
    return trimmed;
  }

  if (tipo_destino === 'externa') {
    if (!/^https?:\/\//i.test(trimmed)) {
      const err = new Error('URL externa deve começar com http:// ou https://.');
      err.status = 400;
      throw err;
    }
    return trimmed;
  }

  const err = new Error('tipo_destino inválido.');
  err.status = 400;
  throw err;
}

function validarFooterConfig(body) {
  if (!body?.marca?.titulo?.trim()) {
    const err = new Error('Título da marca é obrigatório.');
    err.status = 400;
    throw err;
  }

  if (!Array.isArray(body?.colunas)) {
    const err = new Error('Colunas do rodapé são obrigatórias.');
    err.status = 400;
    throw err;
  }

  for (const coluna of body.colunas) {
    if (!coluna?.titulo?.trim()) {
      const err = new Error(`Título da coluna "${coluna?.id ?? '?'}" é obrigatório.`);
      err.status = 400;
      throw err;
    }

    if (!Array.isArray(coluna.links)) continue;

    for (const link of coluna.links) {
      if (!link?.label?.trim()) {
        const err = new Error('Rótulo do link é obrigatório.');
        err.status = 400;
        throw err;
      }

      if (link.url?.trim()) {
        link.url = validarUrl(link.url, link.tipo_destino);
      } else {
        link.url = null;
      }
    }
  }

  if (Array.isArray(body?.sponsors)) {
    for (const sponsor of body.sponsors) {
      if (!sponsor?.label?.trim()) {
        const err = new Error('Rótulo da empresa na barra inferior é obrigatório.');
        err.status = 400;
        throw err;
      }
      if (sponsor.url?.trim()) {
        sponsor.url = validarUrl(sponsor.url, 'externa');
      } else {
        sponsor.url = null;
      }
    }
  }

  return body;
}

async function getFooterPublic(_req, res) {
  try {
    const config = await siteConfigRepo.getFooter();
    return res.json(config);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function getFooterAdmin(_req, res) {
  try {
    const config = await siteConfigRepo.getFooter();
    return res.json(config);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function putFooter(req, res) {
  try {
    const validado = validarFooterConfig(req.body);
    const config = await siteConfigRepo.setFooter(validado);
    return res.json(config);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

module.exports = {
  getFooterPublic,
  getFooterAdmin,
  putFooter,
};
