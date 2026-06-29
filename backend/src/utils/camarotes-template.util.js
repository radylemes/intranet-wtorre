const fs = require('fs');
const path = require('path');
const { diasRestantes } = require('./camarotes-situacao.util');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates', 'camarotes');

const TEMPLATE_FILES = {
  '90dias': 'camarote-90dias.html',
  '30dias': 'camarote-30dias.html',
  hoje: 'camarote-hoje.html',
};

const UNIDADE_EXEMPLO = {
  id: 0,
  tipo_unidade: 'camarote',
  numero: '12',
  setor: 'A',
  andar: '3',
  capacidade: 12,
  cessionario: 'Empresa Exemplo Ltda.',
  tipo_cessionario: 'PJ',
  primeira_locacao: '2020-01-15',
  inicio_locacao: '2023-01-15',
  final_locacao: '2026-09-24',
  valor_anual: 125000,
  valor_total: 375000,
  status_contrato: 'Ativo',
};

function formatDate(value) {
  if (!value) return '—';
  const s = String(value).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (y && m && d) return `${d}/${m}/${y}`;
  return s;
}

function formatMoney(value) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function buildPlaceholderMap(unidade) {
  const dias = diasRestantes(unidade.final_locacao);
  return {
    numero: unidade.numero ?? '—',
    setor: unidade.setor || '—',
    andar: unidade.andar || '—',
    capacidade: unidade.capacidade != null ? String(unidade.capacidade) : '—',
    cessionario: unidade.cessionario || '—',
    tipo_cessionario: unidade.tipo_cessionario || '—',
    primeira_locacao: formatDate(unidade.primeira_locacao),
    inicio_locacao: formatDate(unidade.inicio_locacao),
    final_locacao: formatDate(unidade.final_locacao),
    dias_restantes: dias != null ? String(dias) : '—',
    valor_anual: formatMoney(unidade.valor_anual),
    valor_total: formatMoney(unidade.valor_total),
    status_contrato: unidade.status_contrato || '—',
    XXX: unidade.numero ?? '—',
  };
}

function applyPlaceholders(template, map) {
  let html = template;
  html = html.replace(/\[XXX\]/gi, map.XXX ?? map.numero ?? '—');
  for (const [key, value] of Object.entries(map)) {
    const safe = value != null ? String(value) : '—';
    html = html.replace(new RegExp(`\\[${key}\\]`, 'gi'), safe);
  }
  html = html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    return map[key] != null ? String(map[key]) : '—';
  });
  return html;
}

/** Extrai o conteúdo do body para envio/preview (templates HTML completos). */
function extractEmailFragment(html) {
  const bodyMatch = String(html || '').match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) return bodyMatch[1].trim();
  return String(html || '').trim();
}

function loadTemplate(templateCodigo) {
  const file = TEMPLATE_FILES[templateCodigo];
  if (!file) {
    const err = new Error(`Template de e-mail inválido: ${templateCodigo}`);
    err.status = 400;
    throw err;
  }
  const fullPath = path.join(TEMPLATES_DIR, file);
  return fs.readFileSync(fullPath, 'utf8');
}

function buildCamaroteAlertHtml(templateCodigo, unidade) {
  const template = loadTemplate(templateCodigo);
  const map = buildPlaceholderMap(unidade);
  return extractEmailFragment(applyPlaceholders(template, map));
}

function buildSubject(assuntoTemplate, unidade) {
  const map = buildPlaceholderMap(unidade);
  return applyPlaceholders(assuntoTemplate, map).replace(/<[^>]+>/g, '');
}

function renderPreview(templateCodigo, unidadeExemplo) {
  const unidade = unidadeExemplo || UNIDADE_EXEMPLO;
  return buildCamaroteAlertHtml(templateCodigo, unidade);
}

function templateCodigoFromDias(dias) {
  if (dias === 90) return '90dias';
  if (dias === 30) return '30dias';
  if (dias === 0) return 'hoje';
  return null;
}

module.exports = {
  TEMPLATE_FILES,
  UNIDADE_EXEMPLO,
  loadTemplate,
  buildCamaroteAlertHtml,
  buildSubject,
  renderPreview,
  templateCodigoFromDias,
  buildPlaceholderMap,
  extractEmailFragment,
  applyPlaceholders,
  formatDate,
};
