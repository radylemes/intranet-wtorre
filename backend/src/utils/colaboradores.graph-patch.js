const { isVazio } = require('./colaboradores.pendencias');
const {
  buildExtensionPatch,
  formatNascimentoForExtension,
  formatNascimentoFromColaborador,
  parseAniversarioInput,
} = require('./colaboradores.directory-extension');

const EDITABLE_FIELDS = [
  'cargo',
  'departamento',
  'celular',
  'telefone_fixo',
  'ramal',
  'aniversario',
];

const GRAPH_FIELD_MAP = {
  cargo: 'jobTitle',
  departamento: 'department',
  celular: 'mobilePhone',
  telefone_fixo: 'businessPhones',
};

const EXTENSION_FIELDS = new Set(['ramal', 'aniversario']);

function normalizeEditableValue(field, value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed;
}

function aniversarioFromColaborador(c) {
  if (!c || c.nasc_dia == null || c.nasc_mes == null) return null;
  return formatNascimentoForExtension(c.nasc_dia, c.nasc_mes, c.nasc_ano);
}

function normalizeAniversarioComparable(value, colaborador) {
  if (value == null || String(value).trim() === '') return null;
  const parsed = parseAniversarioInput(value);
  if (parsed.error) return String(value).trim();
  return parsed.dataNascimento;
}

function valuesEqual(field, a, b, currentColaborador) {
  if (field === 'aniversario') {
    const na = normalizeAniversarioComparable(a, currentColaborador);
    const nb = aniversarioFromColaborador(currentColaborador);
    return na === nb;
  }
  const na = normalizeEditableValue(field, a);
  const nb = normalizeEditableValue(field, b);
  return na === nb;
}

function buildNativeGraphPatch(alteracoes) {
  const patch = {};
  for (const alt of alteracoes) {
    if (EXTENSION_FIELDS.has(alt.campo)) continue;

    if (alt.campo === 'telefone_fixo') {
      patch.businessPhones = alt.para ? [alt.para] : [];
    } else if (alt.campo === 'celular') {
      patch.mobilePhone = alt.para;
    } else if (alt.campo === 'cargo') {
      patch.jobTitle = alt.para;
    } else if (alt.campo === 'departamento') {
      patch.department = alt.para;
    }
  }
  return patch;
}

function buildExtensionGraphPatch(alteracoes, clientId) {
  const extPayload = {};
  for (const alt of alteracoes) {
    if (alt.campo === 'ramal') {
      extPayload.ramal = alt.para;
    } else if (alt.campo === 'aniversario') {
      extPayload.dataNascimento = alt.para;
    }
  }
  return buildExtensionPatch(clientId, extPayload);
}

function buildGraphPatch(alteracoes, clientId) {
  return {
    ...buildNativeGraphPatch(alteracoes),
    ...buildExtensionGraphPatch(alteracoes, clientId),
  };
}

function diffEditableFields(row, current, clientId) {
  const alteracoes = [];
  const erros = [];

  if (!current) {
    erros.push('Colaborador não encontrado na base local.');
    return { alteracoes, erros, patch: {} };
  }

  if (!current.ativo) {
    erros.push('Colaborador inativo — importação ignorada.');
    return { alteracoes, erros, patch: {} };
  }

  if (!current.ad_id) {
    erros.push('Colaborador sem ad_id.');
    return { alteracoes, erros, patch: {} };
  }

  for (const field of EDITABLE_FIELDS) {
    const rawNovo = row[field];
    let novo = normalizeEditableValue(field, rawNovo);
    let atual = normalizeEditableValue(field, current[field]);

    if (field === 'aniversario') {
      const parsed = parseAniversarioInput(rawNovo);
      if (parsed.error) {
        if (rawNovo != null && String(rawNovo).trim() !== '') {
          erros.push(parsed.error);
        }
        continue;
      }
      novo = parsed.dataNascimento;
      atual = aniversarioFromColaborador(current);
    }

    if (valuesEqual(field, rawNovo, current[field], current)) continue;

    if (field === 'departamento' && isVazio(novo)) {
      erros.push('Departamento não pode ficar vazio.');
      continue;
    }

    alteracoes.push({ campo: field, de: atual, para: novo });
  }

  const patch = buildGraphPatch(alteracoes, clientId);
  return { alteracoes, erros, patch };
}

module.exports = {
  EDITABLE_FIELDS,
  GRAPH_FIELD_MAP,
  EXTENSION_FIELDS,
  normalizeEditableValue,
  aniversarioFromColaborador,
  buildGraphPatch,
  diffEditableFields,
};
