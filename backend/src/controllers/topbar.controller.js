const fs = require('fs');
const path = require('path');
const siteConfigRepo = require('../repositories/site-config.repository');
const { processLogoImage } = require('../services/grupo-logos-image.service');
const { env } = require('../config/env');
const { ensureGrupoLogosDir } = require('../config/grupo-logos-upload');

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

function validarTopbarConfig(body) {
  if (!body?.suporte?.texto?.trim()) {
    const err = new Error('Texto de suporte/CCO é obrigatório.');
    err.status = 400;
    throw err;
  }

  if (!Array.isArray(body?.logos)) {
    const err = new Error('Lista de logos é obrigatória.');
    err.status = 400;
    throw err;
  }

  for (const logo of body.logos) {
    if (!logo?.id?.trim()) {
      const err = new Error('ID do logo é obrigatório.');
      err.status = 400;
      throw err;
    }
    if (!logo?.nome?.trim()) {
      const err = new Error('Nome do logo é obrigatório.');
      err.status = 400;
      throw err;
    }
    if (!logo?.imagem_url?.trim()) {
      const err = new Error(`Imagem do logo "${logo.nome}" é obrigatória.`);
      err.status = 400;
      throw err;
    }
    if (logo.link_url?.trim()) {
      logo.link_url = validarLinkUrl(logo.link_url);
    } else {
      logo.link_url = null;
    }
  }

  return body;
}

function isStoredLogoUrl(url) {
  return typeof url === 'string' && url.includes('/grupo-logos/');
}

function filenameFromLogoUrl(url) {
  if (!isStoredLogoUrl(url)) return null;
  return path.basename(url.split('?')[0]);
}

function deleteStoredLogoFile(url) {
  const filename = filenameFromLogoUrl(url);
  if (!filename) return;
  const filePath = path.join(env.grupoLogosDir, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

async function getTopbar(_req, res) {
  try {
    const config = await siteConfigRepo.getTopbar();
    return res.json(config);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function getTopbarPublic(_req, res) {
  try {
    const config = await siteConfigRepo.getTopbar();
    return res.json(config);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function putTopbar(req, res) {
  try {
    const current = await siteConfigRepo.getTopbar();
    const validado = validarTopbarConfig(req.body);

    for (const oldLogo of current.logos) {
      const stillUsed = validado.logos.some(
        (l) => l.id === oldLogo.id && l.imagem_url === oldLogo.imagem_url
      );
      if (!stillUsed && isStoredLogoUrl(oldLogo.imagem_url)) {
        deleteStoredLogoFile(oldLogo.imagem_url);
      }
    }

    for (const logo of validado.logos) {
      const prev = current.logos.find((l) => l.id === logo.id);
      if (
        prev &&
        prev.imagem_url !== logo.imagem_url &&
        isStoredLogoUrl(prev.imagem_url)
      ) {
        deleteStoredLogoFile(prev.imagem_url);
      }
    }

    const removed = current.logos.filter(
      (old) => !validado.logos.some((l) => l.id === old.id)
    );
    for (const logo of removed) {
      if (isStoredLogoUrl(logo.imagem_url)) {
        deleteStoredLogoFile(logo.imagem_url);
      }
    }

    const config = await siteConfigRepo.setTopbar(validado);
    return res.json(config);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function uploadLogoImagem(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ mensagem: 'Arquivo de imagem é obrigatório.' });
    }

    const logoId = String(req.params.logoId ?? '').trim();
    if (!logoId) {
      return res.status(400).json({ mensagem: 'ID do logo é obrigatório.' });
    }

    const inputPath = req.file.path;
    const { outputPath, compactado, largura, altura } = await processLogoImage(
      inputPath,
      req.file.originalname
    );

    const filename = path.basename(outputPath);
    const imagem_url = `/api/v1/grupo-logos/${filename}`;

    const config = await siteConfigRepo.getTopbar();
    const logo = config.logos.find((l) => l.id === logoId);
    if (logo) {
      if (isStoredLogoUrl(logo.imagem_url)) {
        deleteStoredLogoFile(logo.imagem_url);
      }
      logo.imagem_url = imagem_url;
      await siteConfigRepo.setTopbar(config);
    }

    return res.json({
      imagem_url,
      compactado,
      largura,
      altura,
    });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function serveLogoFile(req, res) {
  try {
    ensureGrupoLogosDir();
    const filename = path.basename(req.params.filename || '');
    if (!filename || filename.includes('..')) {
      return res.status(400).json({ mensagem: 'Arquivo inválido.' });
    }

    const filePath = path.join(env.grupoLogosDir, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ mensagem: 'Arquivo não encontrado.' });
    }

    res.set('Cache-Control', 'public, max-age=86400');
    return res.sendFile(filePath);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

module.exports = {
  getTopbar,
  getTopbarPublic,
  putTopbar,
  uploadLogoImagem,
  serveLogoFile,
};
