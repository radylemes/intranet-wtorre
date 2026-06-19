const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { env } = require('../config/env');

const MAX_SIDE = Number(process.env.PAGINAS_IMAGENS_MAX_PX) || 2400;
const TARGET_BYTES = (Number(process.env.PAGINAS_IMAGENS_TARGET_KB) || 1800) * 1024;
/** Acima deste tamanho (ou dimensão máx.) a imagem é sempre comprimida. */
const COMPRESS_OVER_BYTES = (Number(process.env.PAGINAS_IMAGENS_COMPRESS_OVER_KB) || 512) * 1024;

const WEBP_QUALITIES = [82, 78, 74, 70, 66];
const PNG_COMPRESSION = [9, 8, 7, 6];

function unlinkSafe(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  try {
    fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
}

async function writeUnderTarget(writeFn, outputPath) {
  for (let i = 0; i < 5; i += 1) {
    await writeFn(i);
    const size = fs.statSync(outputPath).size;
    if (size <= TARGET_BYTES) {
      return { outputPath, size };
    }
  }
  const size = fs.statSync(outputPath).size;
  if (size > env.paginasImagensMaxMb * 1024 * 1024) {
    unlinkSafe(outputPath);
    const err = new Error(
      `Não foi possível comprimir a imagem abaixo de ${env.paginasImagensMaxMb} MB. Use uma imagem menor ou com menos detalhes.`
    );
    err.status = 413;
    throw err;
  }
  return { outputPath, size };
}

function baseResize(pipeline) {
  return pipeline.resize(MAX_SIDE, MAX_SIDE, {
    fit: 'inside',
    withoutEnlargement: true,
  });
}

async function processRaster(inputPath, meta, ext) {
  const hasAlpha = !!meta.hasAlpha;
  const base = inputPath.replace(/\.[^.]+$/, '');

  if (hasAlpha) {
    const outputPath = `${base}.opt.png`;
    const { size } = await writeUnderTarget(async (attempt) => {
      const level = PNG_COMPRESSION[Math.min(attempt, PNG_COMPRESSION.length - 1)];
      await baseResize(sharp(inputPath))
        .png({ compressionLevel: level, adaptiveFiltering: true })
        .toFile(outputPath);
    }, outputPath);

    return {
      outputPath,
      contentType: 'image/png',
      ext: '.png',
      compactado: true,
      bytes: size,
    };
  }

  const outputPath = `${base}.opt.webp`;
  const { size } = await writeUnderTarget(async (attempt) => {
    const quality = WEBP_QUALITIES[Math.min(attempt, WEBP_QUALITIES.length - 1)];
    await baseResize(sharp(inputPath))
      .webp({ quality, effort: 4 })
      .toFile(outputPath);
  }, outputPath);

  return {
    outputPath,
    contentType: 'image/webp',
    ext: '.webp',
    compactado: true,
    bytes: size,
  };
}

async function processGif(inputPath) {
  const meta = await sharp(inputPath, { animated: true }).metadata();
  const stat = fs.statSync(inputPath);
  const animated = (meta.pages || 1) > 1;

  if (!animated && stat.size <= TARGET_BYTES) {
    return processRaster(inputPath, { ...meta, hasAlpha: false }, '.gif');
  }

  if (animated) {
    const base = inputPath.replace(/\.[^.]+$/, '');
    const outputPath = `${base}.opt.gif`;

    if (stat.size <= TARGET_BYTES && (meta.width || 0) <= MAX_SIDE && (meta.height || 0) <= MAX_SIDE) {
      return {
        outputPath: inputPath,
        contentType: 'image/gif',
        ext: '.gif',
        compactado: false,
        bytes: stat.size,
      };
    }

    await baseResize(sharp(inputPath, { animated: true }))
      .gif({ effort: 7 })
      .toFile(outputPath);

    const outSize = fs.statSync(outputPath).size;
    if (outSize > env.paginasImagensMaxMb * 1024 * 1024) {
      unlinkSafe(outputPath);
      const err = new Error(
        `GIF animado excede ${env.paginasImagensMaxMb} MB após compressão. Reduza dimensões ou duração.`
      );
      err.status = 413;
      throw err;
    }

    return {
      outputPath,
      contentType: 'image/gif',
      ext: '.gif',
      compactado: true,
      bytes: outSize,
    };
  }

  return processRaster(inputPath, meta, '.gif');
}

/**
 * Comprime imagem para uso em páginas (WebP/PNG/GIF otimizado).
 * @returns {{ outputPath: string, contentType: string, ext: string, compactado: boolean, bytes: number }}
 */
async function processPaginaImagem(inputPath, originalName) {
  const ext = path.extname(originalName || inputPath).toLowerCase();
  const stat = fs.statSync(inputPath);

  if (ext === '.gif') {
    const result = await processGif(inputPath);
    if (result.outputPath !== inputPath) unlinkSafe(inputPath);
    return result;
  }

  const meta = await sharp(inputPath).metadata();
  const oversized =
    stat.size > COMPRESS_OVER_BYTES ||
    (meta.width || 0) > MAX_SIDE ||
    (meta.height || 0) > MAX_SIDE;

  if (!oversized && ext === '.webp' && stat.size <= TARGET_BYTES) {
    return {
      outputPath: inputPath,
      contentType: 'image/webp',
      ext: '.webp',
      compactado: false,
      bytes: stat.size,
    };
  }

  if (!oversized && stat.size <= COMPRESS_OVER_BYTES) {
    const mime =
      ext === '.png'
        ? 'image/png'
        : ext === '.gif'
          ? 'image/gif'
          : ext === '.webp'
            ? 'image/webp'
            : 'image/jpeg';
    return {
      outputPath: inputPath,
      contentType: mime,
      ext: ext || '.jpg',
      compactado: false,
      bytes: stat.size,
    };
  }

  const result = await processRaster(inputPath, meta, ext);
  if (result.outputPath !== inputPath) unlinkSafe(inputPath);
  return result;
}

module.exports = {
  MAX_SIDE,
  TARGET_BYTES,
  processPaginaImagem,
};
