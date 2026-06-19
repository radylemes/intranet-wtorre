const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { getExtension } = require('../config/grupo-logos-upload');

const LOGO_MAX_WIDTH = 240;
const LOGO_MAX_HEIGHT = 60;
const LOGO_MAX_BYTES = 500 * 1024;

async function processLogoImage(inputPath, originalName) {
  const ext = getExtension(originalName);

  if (ext === '.svg') {
    const stat = fs.statSync(inputPath);
    if (stat.size > LOGO_MAX_BYTES) {
      const err = new Error('SVG excede o limite de 500 KB.');
      err.status = 400;
      throw err;
    }
    return {
      outputPath: inputPath,
      compactado: false,
      largura: null,
      altura: null,
    };
  }

  const meta = await sharp(inputPath).metadata();
  const stat = fs.statSync(inputPath);
  const needsResize =
    (meta.width && meta.width > LOGO_MAX_WIDTH) ||
    (meta.height && meta.height > LOGO_MAX_HEIGHT);
  const needsCompress = stat.size > LOGO_MAX_BYTES;
  const compactado = needsResize || needsCompress;

  let pipeline = sharp(inputPath);
  if (needsResize) {
    pipeline = pipeline.resize(LOGO_MAX_WIDTH, LOGO_MAX_HEIGHT, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  const usePng = meta.hasAlpha || ext === '.png' || ext === '.webp';
  const desiredOutputPath =
    inputPath.replace(/\.[^.]+$/, '') + (usePng ? '.png' : '.jpg');

  const writePath =
    desiredOutputPath === inputPath
      ? `${inputPath}.processing`
      : desiredOutputPath;

  if (usePng) {
    await pipeline.png({ compressionLevel: 9 }).toFile(writePath);
  } else {
    await pipeline.jpeg({ quality: 85 }).toFile(writePath);
  }

  if (writePath !== inputPath && fs.existsSync(inputPath)) {
    fs.unlinkSync(inputPath);
  }

  if (writePath !== desiredOutputPath) {
    fs.renameSync(writePath, desiredOutputPath);
  }

  const outputPath = desiredOutputPath;

  const outMeta = await sharp(outputPath).metadata();
  return {
    outputPath,
    compactado,
    largura: outMeta.width ?? null,
    altura: outMeta.height ?? null,
  };
}

module.exports = {
  LOGO_MAX_WIDTH,
  LOGO_MAX_HEIGHT,
  LOGO_MAX_BYTES,
  processLogoImage,
};
