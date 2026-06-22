const fs = require('fs');
const path = require('path');
const siteConfigRepo = require('../repositories/site-config.repository');
const contentVersionService = require('../services/content-version.service');
const { processBannerImage } = require('../services/home-carrossel-image.service');
const { env } = require('../config/env');
const { ensureHomeCarrosselDir } = require('../config/home-carrossel-upload');

const STORED_URL_PREFIX = '/api/v1/menu/carrossel/arquivos/';

function validarLinkUrl(url) {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    const err = new Error('Link externo deve começar com http:// ou https://.');
    err.status = 400;
    throw err;
  }
  return trimmed;
}

function validarHomeCarrossel(body) {
  if (!body || typeof body !== 'object') {
    const err = new Error('Configuração inválida.');
    err.status = 400;
    throw err;
  }

  if (!Array.isArray(body.slides)) {
    const err = new Error('Lista de slides é obrigatória.');
    err.status = 400;
    throw err;
  }

  for (const slide of body.slides) {
    if (!slide?.id?.trim()) {
      const err = new Error('ID do slide é obrigatório.');
      err.status = 400;
      throw err;
    }
    if (!slide?.url?.trim()) {
      const err = new Error(`Imagem do slide "${slide.id}" é obrigatória.`);
      err.status = 400;
      throw err;
    }
    if (slide.link?.trim()) {
      slide.link = validarLinkUrl(slide.link);
    } else {
      slide.link = null;
    }
  }

  const intervalo = Number(body.intervaloMs);
  if (Number.isFinite(intervalo) && (intervalo < 1000 || intervalo > 60000)) {
    const err = new Error('Intervalo deve estar entre 1000 e 60000 ms.');
    err.status = 400;
    throw err;
  }

  const altura = Number(body.alturaPx);
  if (Number.isFinite(altura) && (altura < 200 || altura > 800)) {
    const err = new Error('Altura do banner deve estar entre 200 e 800 px.');
    err.status = 400;
    throw err;
  }

  return body;
}

function isStoredCarrosselUrl(url) {
  return typeof url === 'string' && url.includes(STORED_URL_PREFIX);
}

function filenameFromCarrosselUrl(url) {
  if (!isStoredCarrosselUrl(url)) return null;
  return path.basename(url.split('?')[0]);
}

function deleteStoredCarrosselFile(url) {
  const filename = filenameFromCarrosselUrl(url);
  if (!filename) return;
  const filePath = path.join(env.homeCarrosselDir, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

async function getCarrossel(_req, res) {
  try {
    const config = await siteConfigRepo.getHomeCarrossel();
    return res.json(config);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function putCarrossel(req, res) {
  try {
    const current = await siteConfigRepo.getHomeCarrossel();
    const validado = validarHomeCarrossel(req.body);

    const newUrls = new Set(validado.slides.map((s) => s.url));
    for (const oldSlide of current.slides) {
      if (isStoredCarrosselUrl(oldSlide.url) && !newUrls.has(oldSlide.url)) {
        deleteStoredCarrosselFile(oldSlide.url);
      }
    }

    for (const slide of validado.slides) {
      const prev = current.slides.find((s) => s.id === slide.id);
      if (
        prev &&
        prev.url !== slide.url &&
        isStoredCarrosselUrl(prev.url)
      ) {
        deleteStoredCarrosselFile(prev.url);
      }
    }

    const config = await siteConfigRepo.setHomeCarrossel(validado);
    await contentVersionService.bump('menu');
    return res.json(config);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function uploadImagem(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ mensagem: 'Arquivo de imagem é obrigatório.' });
    }

    const inputPath = req.file.path;
    const { outputPath, compactado, largura, altura } = await processBannerImage(
      inputPath,
      req.file.originalname
    );

    const filename = path.basename(outputPath);
    const url = `${STORED_URL_PREFIX}${filename}`;

    return res.json({
      url,
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

async function serveArquivo(req, res) {
  try {
    ensureHomeCarrosselDir();
    const filename = path.basename(req.params.filename || '');
    if (!filename || filename.includes('..')) {
      return res.status(400).json({ mensagem: 'Arquivo inválido.' });
    }

    const filePath = path.join(env.homeCarrosselDir, filename);
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
  getCarrossel,
  putCarrossel,
  uploadImagem,
  serveArquivo,
};
