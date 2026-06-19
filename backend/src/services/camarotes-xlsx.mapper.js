const XLSX = require('xlsx');

const HEADER_MAP = {
  andar: ['andar'],
  setor: ['setor'],
  numero: ['numero', 'número', 'numero.'],
  capacidade: ['capacidade do camarote', 'capacidade'],
  cessionario: ['cessionário', 'cessionario'],
  tipo_cessionario: [
    'tipo (cessionário/patrocinador/sep)',
    'tipo (cessionario/patrocinador/sep)',
    'tipo',
  ],
  primeira_locacao: ['primeira locação', 'primeira locacao'],
  inicio_locacao: ['início locação/renovação', 'inicio locacao/renovacao', 'início locação', 'inicio locacao'],
  final_locacao: ['final locação', 'final locacao'],
  tempo_anos: ['tempo de contrato (anos)', 'tempo contrato anos', 'anos'],
  tempo_meses: ['tempo de contrato (meses)', 'tempo contrato meses', 'meses'],
  valor_total: ['valor total', 'r$ valor total'],
  valor_cessao: ['valor cessão', 'valor cessao', 'r$ valor cessão'],
  valor_anual: ['valor anual', 'receita anual', 'r$ valor anual'],
  entrada: ['entrada', 'r$ entrada'],
  valor_parcelado: ['valor parcelado', 'r$ valor parcelado'],
  valor_vagas: ['valor vagas', 'r$ valor vagas', 'valor vvip'],
  qtd_parcelas: ['qtd. parcelas', 'qtd parcelas', 'quantidade parcelas'],
  vagas_vvip: ['vagas vvip', 'vaga vvip'],
  credencial_staff: ['credencial staff', 'credencial'],
  categorias_staff: ['categorias staff', 'categoria staff'],
  pack30: ['pack30 2026', 'pack30'],
  status_contrato: ['status contrato', 'status do contrato'],
};

const REQUIRED_FIELDS = ['numero', 'final_locacao'];

const IGNORE_HEADERS = new Set(['coluna1', '']);

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function removeEmoji(text) {
  return String(text || '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .trim();
}

function parseMoedaPtBr(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return null;
    return Math.round(value * 100) / 100;
  }
  let s = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/R\$/gi, '')
    .trim();
  if (!s || /^-+$/.test(s)) return null;
  s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

function parseIntOrNull(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : null;
  const n = parseInt(String(value).replace(/\D/g, ''), 10);
  return Number.isNaN(n) ? null : n;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatYmd(y, m, d) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function parseDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatYmd(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  if (typeof value === 'number') {
    try {
      const formatted = XLSX.SSF.format('yyyy-mm-dd', value);
      if (formatted && /^\d{4}-\d{2}-\d{2}$/.test(formatted)) return formatted;
    } catch {
      /* fallback abaixo */
    }
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return formatYmd(parsed.y, parsed.m, parsed.d);
    }
  }
  const s = String(value).trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    return formatYmd(Number(br[3]), Number(br[2]), Number(br[1]));
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function parseSimNao(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return value ? 1 : 0;
  const s = String(value).trim().toLowerCase();
  if (['sim', 's', 'yes', '1', 'true', 'x'].includes(s)) return 1;
  return 0;
}

function parseCessionario(value) {
  const s = String(value || '').trim();
  return s ? s : null;
}

function buildColumnIndex(headers) {
  const index = {};
  const normalizedHeaders = headers.map((h) => normalizeHeader(h));

  for (const [field, aliases] of Object.entries(HEADER_MAP)) {
    for (let i = 0; i < normalizedHeaders.length; i += 1) {
      const h = normalizedHeaders[i];
      if (IGNORE_HEADERS.has(h)) continue;
      if (aliases.some((a) => h === normalizeHeader(a) || h.includes(normalizeHeader(a)))) {
        if (index[field] == null) index[field] = i;
        break;
      }
    }
  }

  return index;
}

function validateHeaders(columnIndex) {
  const missing = REQUIRED_FIELDS.filter((f) => columnIndex[f] == null);
  if (missing.length) {
    const labels = {
      numero: 'Número',
      final_locacao: 'Final Locação',
    };
    const err = new Error(
      `Colunas obrigatórias ausentes na planilha: ${missing.map((m) => labels[m] || m).join(', ')}`
    );
    err.status = 400;
    throw err;
  }
}

function mapRow(row, columnIndex, tipoUnidade) {
  const get = (field) => {
    const idx = columnIndex[field];
    if (idx == null) return undefined;
    return row[idx];
  };

  const numero = String(get('numero') || '').trim();
  if (!numero) return null;

  return {
    tipo_unidade: tipoUnidade,
    andar: get('andar') != null ? String(get('andar')).trim() || null : null,
    setor: get('setor') != null ? String(get('setor')).trim() || null : null,
    numero,
    capacidade: parseIntOrNull(get('capacidade')),
    cessionario: parseCessionario(get('cessionario')),
    tipo_cessionario:
      get('tipo_cessionario') != null ? String(get('tipo_cessionario')).trim() || null : null,
    primeira_locacao: parseDate(get('primeira_locacao')),
    inicio_locacao: parseDate(get('inicio_locacao')),
    final_locacao: parseDate(get('final_locacao')),
    tempo_anos: parseIntOrNull(get('tempo_anos')),
    tempo_meses: parseIntOrNull(get('tempo_meses')),
    valor_total: parseMoedaPtBr(get('valor_total')),
    valor_cessao: parseMoedaPtBr(get('valor_cessao')),
    valor_anual: parseMoedaPtBr(get('valor_anual')),
    entrada: parseMoedaPtBr(get('entrada')),
    valor_parcelado: parseMoedaPtBr(get('valor_parcelado')),
    valor_vagas: parseMoedaPtBr(get('valor_vagas')),
    qtd_parcelas: parseIntOrNull(get('qtd_parcelas')),
    vagas_vvip: parseIntOrNull(get('vagas_vvip')),
    credencial_staff:
      get('credencial_staff') != null ? String(get('credencial_staff')).trim() || null : null,
    categorias_staff:
      get('categorias_staff') != null ? String(get('categorias_staff')).trim() || null : null,
    pack30: parseSimNao(get('pack30')),
    status_contrato:
      get('status_contrato') != null
        ? removeEmoji(String(get('status_contrato')).trim()) || null
        : null,
  };
}

function parseWorksheet(buffer, sheetName, tipoUnidade) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    const abas = workbook.SheetNames.join(', ');
    const err = new Error(
      `Aba "${sheetName}" não encontrada no arquivo. Abas disponíveis: ${abas}`
    );
    err.status = 400;
    throw err;
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
  if (!rows.length) {
    return { unidades: [], linhas_lidas: 0 };
  }

  const headers = rows[0].map((h) => String(h || ''));
  const columnIndex = buildColumnIndex(headers);
  validateHeaders(columnIndex);

  const unidades = [];
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.every((c) => c == null || String(c).trim() === '')) continue;
    const mapped = mapRow(row, columnIndex, tipoUnidade);
    if (mapped) unidades.push(mapped);
  }

  return { unidades, linhas_lidas: rows.length - 1 };
}

module.exports = {
  parseWorksheet,
  normalizeHeader,
  parseMoedaPtBr,
  parseDate,
};
