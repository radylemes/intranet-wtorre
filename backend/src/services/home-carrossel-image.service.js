const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { getExtension } = require('../config/home-carrossel-upload');

const BANNER_MAX_WIDTH = 2400;
const BANNER_MAX_HEIGHT = 800;
const BANNER_MAX_BYTES = 2 * 1024 * 1024;

async function processBannerImage(inputPath, originalName) {
  const ext = getExtension(originalName);
  const meta = await sharp(inputPath).metadata();
  const stat = fs.statSync(inputPath);

  const needsResize =
    (meta.width && meta.width > BANNER_MAX_WIDTH) ||
    (meta.height && meta.height > BANNER_MAX_HEIGHT);
  const needsCompress = stat.size > BANNER_MAX_BYTES;
  const compactado = needsResize || needsCompress;

  let pipeline = sharp(inputPath);
  if (needsResize) {
    pipeline = pipeline.resize(BANNER_MAX_WIDTH, BANNER_MAX_HEIGHT, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  const useWebp = ext === '.webp' || ext === '.png';
  const desiredOutputPath =
    inputPath.replace(/\.[^.]+$/, '') + (useWebp ? '.webp' : '.jpg');

  const writePath =
    desiredOutputPath === inputPath
      ? `${inputPath}.processing`
      : desiredOutputPath;

  if (useWebp) {
    await pipeline.webp({ quality: 85 }).toFile(writePath);
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
  BANNER_MAX_WIDTH,
  BANNER_MAX_HEIGHT,
  BANNER_MAX_BYTES,
  processBannerImage,
};
