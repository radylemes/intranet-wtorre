const siteConfigRepo = require('../repositories/site-config.repository');
const { isPaginaInterna } = require('../config/paginas-internas');

function validarUrl(url, tipo_destino) {
  if (!url?.trim()) {
    const err = new Error('URL é obrigatória quando o botão está ativo.');
    err.status = 400;
    throw err;
  }

  const trimmed = url.trim();

  if (tipo_destino === 'interna') {
    if (!trimmed.startsWith('/')) {
      const err = new Error('Página interna deve começar com /.');
      err.status = 400;
      throw err;
    }
    if (!isPaginaInterna(trimmed)) {
      const err = new Error('Página interna não reconhecida.');
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

async function getHeaderChamadoPublic(_req, res) {
  try {
    const config = await siteConfigRepo.getHeaderChamado();
    return res.json(config);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function getConfiguracoes(_req, res) {
  try {
    const header_chamado = await siteConfigRepo.getHeaderChamado();
    return res.json({ header_chamado });
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function putHeaderChamado(req, res) {
  try {
    const { label, url, ativo, abrir_nova_aba, tipo_destino } = req.body;

    if (!label?.trim()) {
      return res.status(400).json({ mensagem: 'Rótulo é obrigatório.' });
    }

    let urlFinal = url?.trim() || null;

    if (ativo) {
      urlFinal = validarUrl(urlFinal, tipo_destino);
    } else if (urlFinal && tipo_destino) {
      urlFinal = validarUrl(urlFinal, tipo_destino);
    }

    const config = await siteConfigRepo.setHeaderChamado({
      label: label.trim(),
      url: urlFinal,
      ativo: !!ativo,
      abrir_nova_aba: abrir_nova_aba !== false,
    });

    return res.json(config);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

module.exports = {
  getHeaderChamadoPublic,
  getConfiguracoes,
  putHeaderChamado,
};
