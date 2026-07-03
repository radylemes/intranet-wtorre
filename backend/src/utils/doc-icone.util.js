const ICONE_PADRAO = 'lucide:folder';

const ICONE_LEGADO_MAP = {
  folder: 'lucide:folder',
  shield: 'lucide:shield',
  brand: 'lucide:badge',
  cap: 'lucide:graduation-cap',
  file: 'lucide:file-text',
};

const ICONE_LEGADO_VALUES = new Set(Object.keys(ICONE_LEGADO_MAP));
const ICONE_REGEX =
  /^(?:(?:lucide|brand):[a-z0-9-]+|material:(?:outlined|rounded|sharp):[a-z0-9_]+|custom:[a-f0-9-]{36})$/;

function normalizarIconePersistido(icone) {
  if (icone == null || icone === '') return null;
  const val = String(icone).trim().toLowerCase();
  if (ICONE_LEGADO_VALUES.has(val)) {
    return ICONE_LEGADO_MAP[val];
  }
  if (ICONE_REGEX.test(val)) {
    return val;
  }
  return null;
}

function validarIconeEntrada(icone) {
  if (icone == null || icone === '') return true;
  return normalizarIconePersistido(icone) != null;
}

module.exports = {
  ICONE_PADRAO,
  ICONE_LEGADO_MAP,
  ICONE_REGEX,
  normalizarIconePersistido,
  validarIconeEntrada,
};
