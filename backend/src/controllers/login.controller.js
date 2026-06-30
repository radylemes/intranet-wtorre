const siteConfigRepo = require('../repositories/site-config.repository');
const contentVersionService = require('../services/content-version.service');

function validarLinkUrl(url) {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    const err = new Error('URL externa deve começar com http:// ou https://.');
    err.status = 400;
    throw err;
  }
  return trimmed;
}

function validarLoginConfig(body) {
  if (!body?.marca_topo?.titulo?.trim()) {
    const err = new Error('Título da marca no topo é obrigatório.');
    err.status = 400;
    throw err;
  }
  if (!body?.marca_topo?.subtitulo?.trim()) {
    const err = new Error('Subtítulo da marca no topo é obrigatório.');
    err.status = 400;
    throw err;
  }
  if (!body?.hero?.titulo_linha1?.trim()) {
    const err = new Error('Título do hero (linha 1) é obrigatório.');
    err.status = 400;
    throw err;
  }
  if (!body?.hero?.titulo_destaque?.trim()) {
    const err = new Error('Título do hero (destaque) é obrigatório.');
    err.status = 400;
    throw err;
  }
  if (!body?.hero?.lead?.trim()) {
    const err = new Error('Texto de apoio do hero é obrigatório.');
    err.status = 400;
    throw err;
  }
  if (!body?.pill?.texto?.trim()) {
    const err = new Error('Texto do selo restrito é obrigatório.');
    err.status = 400;
    throw err;
  }
  if (!body?.auth?.titulo?.trim()) {
    const err = new Error('Título da seção de autenticação é obrigatório.');
    err.status = 400;
    throw err;
  }
  if (!body?.auth?.subtitulo?.trim()) {
    const err = new Error('Subtítulo da seção de autenticação é obrigatório.');
    err.status = 400;
    throw err;
  }
  if (!body?.aviso_seguranca?.trim()) {
    const err = new Error('Aviso de segurança é obrigatório.');
    err.status = 400;
    throw err;
  }
  if (!body?.rodape?.copyright?.trim()) {
    const err = new Error('Texto de copyright do rodapé é obrigatório.');
    err.status = 400;
    throw err;
  }
  if (!body?.rodape?.contato?.trim()) {
    const err = new Error('Texto de contato do rodapé é obrigatório.');
    err.status = 400;
    throw err;
  }
  if (!body?.empresas_titulo?.trim()) {
    const err = new Error('Título da seção de empresas é obrigatório.');
    err.status = 400;
    throw err;
  }
  if (!Array.isArray(body?.empresas) || !body.empresas.length) {
    const err = new Error('Lista de empresas é obrigatória.');
    err.status = 400;
    throw err;
  }

  for (const empresa of body.empresas) {
    if (!empresa?.id?.trim()) {
      const err = new Error('ID da empresa é obrigatório.');
      err.status = 400;
      throw err;
    }
    if (!empresa?.nome?.trim()) {
      const err = new Error('Nome da empresa é obrigatório.');
      err.status = 400;
      throw err;
    }
    if (empresa.link_url?.trim()) {
      empresa.link_url = validarLinkUrl(empresa.link_url);
    } else {
      empresa.link_url = null;
    }
  }

  return body;
}

async function getLoginPublic(_req, res) {
  try {
    const config = await siteConfigRepo.getLogin();
    return res.json(config);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function getLogin(_req, res) {
  try {
    const config = await siteConfigRepo.getLogin();
    return res.json(config);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function putLogin(req, res) {
  try {
    const validado = validarLoginConfig(req.body);
    const config = await siteConfigRepo.setLogin(validado);
    await contentVersionService.bump('login');
    return res.json(config);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

module.exports = {
  getLoginPublic,
  getLogin,
  putLogin,
};
