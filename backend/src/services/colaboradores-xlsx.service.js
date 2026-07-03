const XLSX = require('xlsx');
const colaboradoresRepo = require('../repositories/colaboradores.repository');
const tenantsRepo = require('../repositories/tenants.repository');
const syncService = require('./colaboradores.sync');
const graphUpdateService = require('./colaboradores-graph-update.service');
const { computePendencias } = require('../utils/colaboradores.pendencias');
const { diffEditableFields } = require('../utils/colaboradores.graph-patch');
const {
  formatNascimentoForExtension,
  parseAniversarioInput,
} = require('../utils/colaboradores.directory-extension');

const EXPORT_COLUMNS = [
  'ad_id',
  'email',
  'nome',
  'cargo',
  'departamento',
  'celular',
  'telefone_fixo',
  'ramal',
  'aniversario',
  'empresa',
  'pendencias',
];

const INSTRUCTIONS_ROW = [
  'NÃO EDITAR — chave Azure AD',
  'NÃO EDITAR',
  'NÃO EDITAR',
  'Editável → Graph jobTitle',
  'Editável → Graph department',
  'Editável → Graph mobilePhone',
  'Editável → Graph businessPhones[0]',
  'Editável → directory extension ramal',
  'Editável → directory extension dataNascimento (DD/MM/AAAA)',
  'Informativo (domínio e-mail)',
  'Informativo',
];

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

function formatAniversario(c) {
  if (!c.nasc_dia || !c.nasc_mes) return '';
  const dia = String(c.nasc_dia).padStart(2, '0');
  const mes = String(c.nasc_mes).padStart(2, '0');
  if (c.nasc_ano) return `${dia}/${mes}/${c.nasc_ano}`;
  return `${dia}/${mes}`;
}

function formatPendencias(c) {
  return computePendencias(c).join(', ');
}

function cellValue(value) {
  if (value == null) return '';
  return String(value).trim();
}

function normalizeAniversarioCell(value) {
  if (value == null || value === '') return '';

  if (typeof value === 'number' && Number.isFinite(value)) {
    const dc = XLSX.SSF.parse_date_code(value);
    if (dc && dc.m >= 1 && dc.m <= 12 && dc.d >= 1 && dc.d <= 31) {
      const ano = dc.y >= 1900 ? dc.y : null;
      return formatNascimentoForExtension(dc.d, dc.m, ano);
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const parsed = parseAniversarioInput(
      formatNascimentoForExtension(
        value.getUTCDate(),
        value.getUTCMonth() + 1,
        value.getUTCFullYear()
      )
    );
    return parsed.dataNascimento || '';
  }

  const parsed = parseAniversarioInput(value);
  return parsed.dataNascimento ?? String(value).trim().split(/\s+/)[0];
}

function cellValueForColumn(column, value) {
  if (column === 'aniversario') return normalizeAniversarioCell(value);
  return cellValue(value);
}

function buildExportRows(colaboradores) {
  const rows = [EXPORT_COLUMNS, INSTRUCTIONS_ROW];
  for (const c of colaboradores) {
    rows.push([
      c.ad_id || '',
      c.email || '',
      c.nome || '',
      c.cargo || '',
      c.departamento || '',
      c.celular || '',
      c.telefone_fixo || '',
      c.ramal || '',
      formatAniversario(c),
      c.empresa || '',
      formatPendencias(c),
    ]);
  }
  return rows;
}

async function exportar(filtros) {
  const colaboradores = await colaboradoresRepo.findAllForExport(filtros);
  const ws = XLSX.utils.aoa_to_sheet(buildExportRows(colaboradores));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Colaboradores');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function parseWorksheet(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    const err = new Error('Planilha vazia.');
    err.status = 400;
    throw err;
  }

  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
  if (!matrix.length) {
    const err = new Error('Planilha sem dados.');
    err.status = 400;
    throw err;
  }

  const headerRow = matrix[0].map(normalizeHeader);
  const colIndex = {};
  for (let i = 0; i < headerRow.length; i += 1) {
    const key = headerRow[i];
    if (key && EXPORT_COLUMNS.includes(key)) {
      colIndex[key] = i;
    }
  }

  if (colIndex.ad_id == null && colIndex.email == null) {
    const err = new Error('Cabeçalho inválido: coluna ad_id ou email obrigatória.');
    err.status = 400;
    throw err;
  }

  const linhas = [];
  for (let rowIdx = 2; rowIdx < matrix.length; rowIdx += 1) {
    const raw = matrix[rowIdx];
    if (!raw || !raw.length) continue;

    const row = {};
    for (const col of EXPORT_COLUMNS) {
      const idx = colIndex[col];
      row[col] = idx != null ? cellValueForColumn(col, raw[idx]) : '';
    }

    if (!row.ad_id && !row.email) continue;

    linhas.push({ linha: rowIdx + 1, row });
  }

  return linhas;
}

async function resolverColaborador(row) {
  if (row.ad_id) {
    const byAd = await colaboradoresRepo.findAdminByAdId(row.ad_id);
    if (byAd) return byAd;
  }
  if (row.email) {
    return colaboradoresRepo.findAdminByEmail(row.email);
  }
  return null;
}

async function resolveClientId(colaborador) {
  if (!colaborador?.tenant_id) return null;
  const tenant = await tenantsRepo.findById(colaborador.tenant_id);
  return tenant?.client_id || null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function aplicarImport(buffer, auditMeta) {
  const parsed = parseWorksheet(buffer);
  const erros = [];
  let aplicados = 0;
  let ignorados = 0;

  for (const { linha, row } of parsed) {
    const colaborador = await resolverColaborador(row);

    if (!colaborador) {
      ignorados += 1;
      erros.push({
        linha,
        ad_id: row.ad_id || null,
        mensagem: 'Colaborador não encontrado na base local.',
      });
      continue;
    }

    const preview = diffEditableFields(
      row,
      colaborador,
      await resolveClientId(colaborador)
    );
    if (preview.erros.length) {
      ignorados += 1;
      for (const msg of preview.erros) {
        erros.push({ linha, ad_id: colaborador.ad_id || row.ad_id || null, mensagem: msg });
      }
      continue;
    }

    if (!preview.alteracoes.length) {
      ignorados += 1;
      continue;
    }

    try {
      const result = await graphUpdateService.updateColaboradorGraph(
        colaborador.id,
        row,
        auditMeta,
        { skipSync: true, auditAction: 'COLABORADORES_IMPORT_GRAPH' }
      );
      if (result.alterado) {
        aplicados += 1;
        await sleep(150);
      } else {
        ignorados += 1;
      }
    } catch (err) {
      ignorados += 1;
      erros.push({
        linha,
        ad_id: colaborador.ad_id,
        mensagem: err.message || 'Erro ao atualizar no Graph.',
      });
    }
  }

  let sync = null;
  if (aplicados > 0) {
    try {
      sync = await syncService.sincronizarColaboradores();
    } catch (err) {
      erros.push({
        linha: null,
        ad_id: null,
        mensagem: `PATCH aplicado, mas sync falhou: ${err.message}`,
      });
    }
  }

  return { aplicados, ignorados, erros, sync };
}

async function previewImport(buffer) {
  const parsed = parseWorksheet(buffer);
  const linhas = [];

  for (const { linha, row } of parsed) {
    const erros = [];

    if (!row.ad_id && !row.email) {
      erros.push('Informe ad_id ou email.');
    }

    const colaborador = await resolverColaborador(row);
    const clientId = await resolveClientId(colaborador);
    const { alteracoes, erros: diffErros } = diffEditableFields(row, colaborador, clientId);

    linhas.push({
      linha,
      ad_id: colaborador?.ad_id || row.ad_id || null,
      nome: colaborador?.nome || row.nome || null,
      email: colaborador?.email || row.email || null,
      alteracoes,
      erros: [...erros, ...diffErros],
      aplicavel: erros.length === 0 && diffErros.length === 0 && alteracoes.length > 0,
    });
  }

  const comAlteracoes = linhas.filter((l) => l.alteracoes.length > 0).length;
  const comErros = linhas.filter((l) => l.erros.length > 0).length;
  const aplicaveis = linhas.filter((l) => l.aplicavel).length;

  return {
    linhas,
    resumo: {
      total: linhas.length,
      com_alteracoes: comAlteracoes,
      com_erros: comErros,
      aplicaveis,
    },
  };
}

module.exports = {
  exportar,
  previewImport,
  aplicarImport,
  EXPORT_COLUMNS,
};
