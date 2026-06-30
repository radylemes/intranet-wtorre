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
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function emojiPorTipo(tipo) {
  const key = String(tipo || '').toUpperCase();
  return EMOJI_POR_TIPO[key] || EMOJI_POR_TIPO.OUTRO;
}

function parseMes(mesRaw) {
  const m = String(mesRaw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .slice(0, 3);
  return MESES[m] || null;
}

function dataIsoFromTexto(dataTexto, refDate = new Date()) {
  const match = String(dataTexto || '').match(/(\d{1,2})\s+de\s+([a-záéíóúãõ.]+)/i);
  if (!match) return null;

  const day = Number.parseInt(match[1], 10);
  const month = parseMes(match[2]);
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

function dataHoraFromUrl(url) {
  const match = String(url || '').match(/-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})(?:\?|$)/);
  if (!match) return { dataIso: null, hora: null };

  const [, y, m, d, hh, mm] = match;
  return {
    dataIso: `${y}-${m}-${d}`,
    hora: `${hh}:${mm}`,
  };
}

function inferirTipo(titulo, subtitulo) {
  const texto = `${titulo || ''} ${subtitulo || ''}`.toLowerCase();
  if (/\b(copa|futebol|jogo|fan zone|brasil x)\b/.test(texto)) return 'JOGO';
  if (/\b(show|concert|m[uú]sica|festival|katinguel)\b/.test(texto)) return 'SHOW';
  return 'OUTRO';
}

function melhorarImagemWix(src) {
  if (!src) return null;
  const raw = String(src).trim();
  if (!raw.includes('wixstatic.com')) return raw;
  return raw.replace(/\/v1\/fill\/[^/]+\//, '/v1/fill/w_400,h_300,al_c,q_85,usm_0.66_1.00_0.01/');
}

function encontrarCard($, $date) {
  let $node = $date;
  let $best = null;

  for (let depth = 0; depth < 12; depth += 1) {
    $node = $node.parent();
    if (!$node.length) break;

    const dates = $node.find('[data-hook="short-date"]');
    const links = $node.find('a[href*="novoanhangabau.com.br/event-details"]');
    if (dates.length === 1 && links.length >= 1) {
      $best = $node;
      continue;
    }
    if (dates.length > 1) break;
  }

  return $best;
}

function extrairEventoDoCard($, $card, fonte) {
  const link = $card
    .find('a[href*="novoanhangabau.com.br/event-details"]')
    .filter((_i, el) => Boolean($(el).text().trim()))
    .first();

  const titulo = decodeHtml(link.text().trim());
  const url = link.attr('href') || null;
  if (!titulo || !url) return null;

  const dataTextoRaw = $card.find('[data-hook="short-date"]').first().text().trim();
  const local = decodeHtml($card.find('[data-hook="short-location"]').first().text().trim()) || null;
  const { dataIso: dataIsoUrl, hora: horaUrl } = dataHoraFromUrl(url);
  const dataIso = dataIsoUrl || dataIsoFromTexto(dataTextoRaw);
  const dataTexto = horaUrl ? `${dataTextoRaw} · ${horaUrl}` : dataTextoRaw;
  const subtitulo = local;

  const imgEl = $card.find('img[src*="wixstatic"]').first();
  const imagemUrl = melhorarImagemWix(imgEl.attr('src'));

  const tipo = inferirTipo(titulo, subtitulo);

  return {
    fonteCodigo: fonte.codigo,
    fonteNome: fonte.nome,
    tipo,
    titulo,
    subtitulo,
    dataTexto: dataTexto || 'Data a confirmar',
    dataIso,
    url,
    imagemUrl,
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
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  const eventos = [];
  const vistos = new Set();

  $('[data-hook="short-date"]').each((_i, el) => {
    const $card = encontrarCard($, $(el));
    if (!$card) return;

    const evento = extrairEventoDoCard($, $card, fonte);
    if (!evento || vistos.has(evento.url)) return;

    vistos.add(evento.url);
    eventos.push(evento);
  });

  const limite = fonte.limite != null ? Number(fonte.limite) : null;
  if (limite && limite > 0) {
    return eventos.slice(0, limite);
  }
  return eventos;
}

module.exports = {
  codigo: 'wix_event_list',
  nome: 'Wix — Lista de eventos',
  descricao: 'Agenda Wix Events (data-hook short-date / event-details)',
  parse,
  emojiPorTipo,
};
