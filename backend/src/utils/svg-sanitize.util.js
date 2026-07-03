function sanitizeSvgContent(content, context = 'svg') {
  if (/<script[\s>]/i.test(content)) {
    throw new Error(`Conteúdo suspeito (<script>) em ${context}`);
  }
  if (/\son[a-z]+\s*=/i.test(content)) {
    throw new Error(`Conteúdo suspeito (atributos de evento) em ${context}`);
  }
  if (/javascript:/i.test(content)) {
    throw new Error(`Conteúdo suspeito (javascript:) em ${context}`);
  }
  return content
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"])[^'"]*\1/gi, '');
}

function sanitizeSvgFile(buffer, context = 'svg') {
  const text = buffer.toString('utf8').trim();
  if (!text) {
    const err = new Error('Arquivo SVG vazio.');
    err.status = 400;
    throw err;
  }
  if (!/<svg[\s>]/i.test(text)) {
    const err = new Error('O arquivo não contém um elemento SVG válido.');
    err.status = 400;
    throw err;
  }
  return sanitizeSvgContent(text, context);
}

module.exports = {
  sanitizeSvgContent,
  sanitizeSvgFile,
};
