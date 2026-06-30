const MESES = {
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12,
};

const EMOJI_POR_TIPO = {
  SHOW: '🎤',
  JOGO: '⚽',
  OUTRO: '📅',
};

function decodeHtml(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#8217;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function emojiPorTipo(tipo) {
  const key = String(tipo || '').toUpperCase();
  return EMOJI_POR_TIPO[key] || EMOJI_POR_TIPO.OUTRO;
}

function resolverImagemUrl(path, baseUrl) {
  if (!path) return null;
  const raw = String(path).trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  try {
    return new URL(raw, baseUrl).href;
  } catch {
    return null;
  }
}

function parseMes(mesRaw) {
  const m = String(mesRaw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .slice(0, 3);
  return MESES[m] || null;
}

function dataIsoFromDiaMes(diaRaw, mesRaw, refDate = new Date()) {
  const day = Number.parseInt(String(diaRaw).replace(/\D/g, ''), 10);
  const month = parseMes(mesRaw);
  if (!day || !month) return null;

  const year = refDate.getFullYear();
  let candidate = new Date(year, month - 1, day);
  const startOfToday = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  if (candidate < startOfToday) {
    candidate = new Date(year + 1, month - 1, day);
  }
  if (Number.isNaN(candidate.getTime())) return null;

  const y = candidate.getFullYear();
  const m = String(candidate.getMonth() + 1).padStart(2, '0');
  const d = String(candidate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatarDataTexto(diaRaw, mesRaw, horaRaw) {
  const dia = String(diaRaw || '').trim();
  const mes = String(mesRaw || '').trim();
  const hora = String(horaRaw || '').trim();
  if (!dia && !mes) return 'Data a confirmar';
  const base = [dia, mes].filter(Boolean).join(' ');
  return hora ? `${base} · ${hora}` : base;
}

function mapImagensPorPostId(html, baseUrl) {
  const map = new Map();
  const re =
    /\.e-loop-item-(\d+)[^}]*background-image:\s*url\(["']?([^"')]+)["']?\)/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    map.set(match[1], resolverImagemUrl(match[2], baseUrl));
  }
  return map;
}

function extrairSubtitulo($item) {
  const p = $item.find('.elementor-element-cdbb1c8 p').first().text().trim();
  if (p) return decodeHtml(p);
  const alt = $item.find('.elementor-widget-text-editor p').first().text().trim();
  return decodeHtml(alt);
}

function normalizarEventoBruto(bruto, fonte, baseUrl, imagensPorPostId) {
  const postIdMatch = (bruto.postClass || '').match(/e-loop-item-(\d+)/);
  const postId = postIdMatch ? postIdMatch[1] : null;
  const dataIso = dataIsoFromDiaMes(bruto.dia, bruto.mes);
  const tipo = decodeHtml(bruto.tipo || 'OUTRO').toUpperCase() || 'OUTRO';

  return {
    fonteCodigo: fonte.codigo,
    fonteNome: fonte.nome,
    tipo,
    titulo: decodeHtml(bruto.titulo),
    subtitulo: bruto.subtitulo || null,
    dataTexto: formatarDataTexto(bruto.dia, bruto.mes, bruto.hora),
    dataIso,
    url: bruto.url || null,
    imagemUrl: postId ? imagensPorPostId.get(postId) || null : null,
    emoji: emojiPorTipo(tipo),
  };
}

async function parse(fonte) {
  const url = fonte.url;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'IntranetWTorre/1.0 (+eventos)',
      Accept: 'text/html',
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const err = new Error(`Falha ao buscar ${url}: HTTP ${res.status}`);
    err.status = 502;
    throw err;
  }

  const html = await res.text();
  const baseUrl = new URL(url).origin;
  const imagensPorPostId = mapImagensPorPostId(html, baseUrl);

  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  const eventos = [];

  $('.e-loop-item.category-agenda').each((_i, el) => {
    const $item = $(el);
    const postClass = $item.attr('class') || '';

    const tipo = $item.find('h2.elementor-heading-title').first().text().trim();
    const tituloEl = $item.find('h6.elementor-heading-title').first();
    const titulo = tituloEl.text().trim();
    const link = tituloEl.find('a').attr('href') || $item.find('a[href]').first().attr('href');
    const urlEvento = link ? resolverImagemUrl(link, baseUrl) : null;

    const $dates = $item.find('.elementor-widget-allianz_parque_event_dates').first();
    const dia = $dates.find('.day').first().text().trim();
    const mes = $dates.find('.month').first().text().trim();
    const hora = $dates.find('.hour').first().text().trim();
    const subtitulo = extrairSubtitulo($item);

    if (!titulo) return;

    eventos.push(
      normalizarEventoBruto(
        { postClass, tipo, titulo, subtitulo, dia, mes, hora, url: urlEvento },
        fonte,
        baseUrl,
        imagensPorPostId
      )
    );
  });

  const limite = fonte.limite != null ? Number(fonte.limite) : null;
  if (limite && limite > 0) {
    return eventos.slice(0, limite);
  }
  return eventos;
}

module.exports = {
  codigo: 'nubankparque_elementor',
  nome: 'Nubank Parque / Elementor',
  descricao: 'Agenda WordPress Elementor (cards .e-loop-item.category-agenda)',
  parse,
  emojiPorTipo,
};
