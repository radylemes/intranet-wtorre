const crypto = require('crypto');
const sanitizeHtml = require('sanitize-html');
const paginasRepo = require('../repositories/paginas.repository');

const TIPOS_BLOCO = new Set(['texto', 'imagem', 'carrossel', 'botao']);
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STATUS_VALIDOS = new Set(['rascunho', 'publicada']);

const SANITIZE_OPTIONS = {
  allowedTags: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'h3', 'h4'],
  allowedAttributes: {
    a: ['href', 'rel', 'target'],
  },
  transformTags: {
    a: (tagName, attribs) => {
      const href = attribs.href || '';
      if (!isUrlPermitida(href)) {
        return { tagName: 'span', attribs: {} };
      }
      const isExterna = /^https?:\/\//i.test(href);
      return {
        tagName: 'a',
        attribs: {
          href,
          ...(isExterna ? { rel: 'noopener', target: '_blank' } : {}),
        },
      };
    },
  },
};

function erro(mensagem, status = 400) {
  const err = new Error(mensagem);
  err.status = status;
  throw err;
}

function normalizarSlug(input) {
  if (!input || typeof input !== 'string') return '';
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);
}

function validarSlug(slug) {
  const s = normalizarSlug(slug);
  if (!s || s.length > 160 || !SLUG_REGEX.test(s)) {
    erro('Slug inválido. Use apenas letras minúsculas, números e hífens.');
  }
  return s;
}

function isUrlPermitida(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return false;
  }
  if (trimmed.startsWith('/')) return true;
  return /^https?:\/\/.+/i.test(trimmed);
}

function validarUrlOpcional(url, campo) {
  if (url == null || url === '') return null;
  if (typeof url !== 'string' || !isUrlPermitida(url)) {
    erro(`${campo} inválida. Use http(s):// ou caminho relativo começando com /.`);
  }
  return url.trim();
}

function validarUrlObrigatoria(url, campo) {
  const v = validarUrlOpcional(url, campo);
  if (!v) erro(`${campo} é obrigatória.`);
  return v;
}

function onlyAllowedKeys(obj, allowed, contexto) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    erro(`Configuração inválida em ${contexto}.`);
  }
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      erro(`Campo desconhecido "${key}" em ${contexto}.`);
    }
  }
}

function sanitizarHtml(html) {
  if (typeof html !== 'string') return '';
  return sanitizeHtml(html, SANITIZE_OPTIONS).trim();
}

function validarBlocoTexto(config, idx) {
  onlyAllowedKeys(config, new Set(['titulo', 'html']), `bloco texto #${idx + 1}`);
  const html = sanitizarHtml(config.html);
  if (!html) erro(`Bloco texto #${idx + 1}: conteúdo HTML é obrigatório.`);
  const out = { html };
  if (config.titulo != null && config.titulo !== '') {
    if (typeof config.titulo !== 'string') erro(`Bloco texto #${idx + 1}: título inválido.`);
    out.titulo = config.titulo.trim().slice(0, 200);
  }
  return out;
}

function validarSlide(slide, blocoIdx, slideIdx) {
  onlyAllowedKeys(slide, new Set(['url', 'alt', 'legenda', 'link']), `carrossel #${blocoIdx + 1} slide #${slideIdx + 1}`);
  const url = validarUrlObrigatoria(slide.url, `carrossel #${blocoIdx + 1} slide #${slideIdx + 1} url`);
  const out = { url };
  if (slide.alt != null && slide.alt !== '') out.alt = String(slide.alt).trim().slice(0, 200);
  if (slide.legenda != null && slide.legenda !== '') out.legenda = String(slide.legenda).trim().slice(0, 500);
  const link = validarUrlOpcional(slide.link, `carrossel #${blocoIdx + 1} slide #${slideIdx + 1} link`);
  if (link) out.link = link;
  return out;
}

function validarBlocoImagem(config, idx) {
  onlyAllowedKeys(config, new Set(['url', 'alt', 'legenda', 'link']), `bloco imagem #${idx + 1}`);
  const url = validarUrlObrigatoria(config.url, `bloco imagem #${idx + 1} url`);
  const out = { url };
  if (config.alt != null && config.alt !== '') out.alt = String(config.alt).trim().slice(0, 200);
  if (config.legenda != null && config.legenda !== '') out.legenda = String(config.legenda).trim().slice(0, 500);
  const link = validarUrlOpcional(config.link, `bloco imagem #${idx + 1} link`);
  if (link) out.link = link;
  return out;
}

function validarBlocoCarrossel(config, idx) {
  onlyAllowedKeys(
    config,
    new Set(['slides', 'autoplay', 'intervaloMs']),
    `bloco carrossel #${idx + 1}`
  );
  if (!Array.isArray(config.slides) || config.slides.length === 0) {
    erro(`Bloco carrossel #${idx + 1}: ao menos um slide é obrigatório.`);
  }
  const out = {
    slides: config.slides.map((s, i) => validarSlide(s, idx, i)),
  };
  if (config.autoplay != null) out.autoplay = !!config.autoplay;
  if (config.intervaloMs != null) {
    const ms = Number(config.intervaloMs);
    if (!Number.isFinite(ms) || ms < 1000 || ms > 60000) {
      erro(`Bloco carrossel #${idx + 1}: intervaloMs deve estar entre 1000 e 60000.`);
    }
    out.intervaloMs = Math.round(ms);
  }
  return out;
}

function validarBlocoBotao(config, idx) {
  onlyAllowedKeys(
    config,
    new Set(['label', 'url', 'estilo', 'alinhamento', 'novaAba']),
    `bloco botão #${idx + 1}`
  );
  const label = typeof config.label === 'string' ? config.label.trim() : '';
  if (!label) erro(`Bloco botão #${idx + 1}: label é obrigatório.`);
  const url = validarUrlObrigatoria(config.url, `bloco botão #${idx + 1} url`);
  const estilos = new Set(['primario', 'secundario', 'fantasma']);
  const alinhamentos = new Set(['left', 'center', 'right']);
  const estilo = config.estilo || 'primario';
  const alinhamento = config.alinhamento || 'left';
  if (!estilos.has(estilo)) erro(`Bloco botão #${idx + 1}: estilo inválido.`);
  if (!alinhamentos.has(alinhamento)) erro(`Bloco botão #${idx + 1}: alinhamento inválido.`);
  return {
    label: label.slice(0, 120),
    url,
    estilo,
    alinhamento,
    ...(config.novaAba != null ? { novaAba: !!config.novaAba } : {}),
  };
}

function normalizarBlocos(blocos) {
  if (!Array.isArray(blocos)) erro('Blocos deve ser um array.');
  return blocos.map((bloco, idx) => {
    if (!bloco || typeof bloco !== 'object') erro(`Bloco #${idx + 1} inválido.`);
    onlyAllowedKeys(bloco, new Set(['id', 'tipo', 'ordem', 'config']), `bloco #${idx + 1}`);
    const tipo = bloco.tipo;
    if (!TIPOS_BLOCO.has(tipo)) erro(`Bloco #${idx + 1}: tipo "${tipo}" não permitido.`);
    const config = bloco.config;
    if (!config || typeof config !== 'object') erro(`Bloco #${idx + 1}: config é obrigatório.`);

    let configNormalizado;
    switch (tipo) {
      case 'texto':
        configNormalizado = validarBlocoTexto(config, idx);
        break;
      case 'imagem':
        configNormalizado = validarBlocoImagem(config, idx);
        break;
      case 'carrossel':
        configNormalizado = validarBlocoCarrossel(config, idx);
        break;
      case 'botao':
        configNormalizado = validarBlocoBotao(config, idx);
        break;
      default:
        erro(`Bloco #${idx + 1}: tipo não suportado.`);
    }

    return {
      id: typeof bloco.id === 'string' && bloco.id.trim() ? bloco.id.trim() : crypto.randomUUID(),
      tipo,
      ordem: idx,
      config: configNormalizado,
    };
  });
}

function validarPayload(body, { isUpdate = false, exceptId = null } = {}) {
  const out = {};

  if (body.titulo !== undefined) {
    const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
    if (!titulo) erro('Título é obrigatório.');
    if (titulo.length > 200) erro('Título deve ter no máximo 200 caracteres.');
    out.titulo = titulo;
  } else if (!isUpdate) {
    erro('Título é obrigatório.');
  }

  if (body.descricao !== undefined) {
    if (body.descricao == null || body.descricao === '') {
      out.descricao = null;
    } else {
      const desc = String(body.descricao).trim();
      if (desc.length > 500) erro('Descrição deve ter no máximo 500 caracteres.');
      out.descricao = desc;
    }
  }

  if (body.slug !== undefined) {
    const slug = validarSlug(body.slug);
    out.slug = slug;
  } else if (!isUpdate) {
    erro('Slug é obrigatório.');
  }

  if (body.status !== undefined) {
    if (!STATUS_VALIDOS.has(body.status)) erro('Status inválido. Use rascunho ou publicada.');
    out.status = body.status;
  }

  if (body.blocos !== undefined) {
    out.blocos = normalizarBlocos(body.blocos);
  } else if (!isUpdate) {
    out.blocos = [];
  }

  return { payload: out, exceptId };
}

async function garantirSlugUnico(slug, exceptId = null) {
  const exists = await paginasRepo.slugExiste(slug, exceptId);
  if (exists) {
    erro('Já existe uma página com este slug.', 409);
  }
}

async function prepararCriacao(body, criadoPor) {
  const { payload } = validarPayload(body, { isUpdate: false });
  await garantirSlugUnico(payload.slug);
  return { ...payload, criado_por: criadoPor || null };
}

async function prepararAtualizacao(id, body) {
  const existing = await paginasRepo.buscarPorId(id);
  if (!existing) erro('Página não encontrada.', 404);

  const { payload } = validarPayload(body, { isUpdate: true, exceptId: id });

  if (payload.slug) {
    await garantirSlugUnico(payload.slug, id);
  }

  return payload;
}

module.exports = {
  normalizarSlug,
  validarSlug,
  normalizarBlocos,
  validarPayload,
  prepararCriacao,
  prepararAtualizacao,
  sanitizarHtml,
  isUrlPermitida,
};
