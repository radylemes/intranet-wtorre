function isCessionarioVago(value) {
  if (value == null) return true;
  const s = String(value).trim();
  if (!s) return true;
  const u = s.toUpperCase();
  if (u === 'VAGO' || u === 'VAGA' || u === '-') return true;
  if (/^VAGO(\s|\(|-)/.test(u)) return true;
  return false;
}

function sqlCessionarioVagoExpr(tableAlias = '') {
  const c = tableAlias ? `${tableAlias}.cessionario` : 'cessionario';
  return `(
    TRIM(COALESCE(${c}, '')) = ''
    OR UPPER(TRIM(${c})) IN ('VAGO', 'VAGA', '-')
    OR UPPER(TRIM(${c})) LIKE 'VAGO %'
    OR UPPER(TRIM(${c})) LIKE 'VAGO(%'
    OR UPPER(TRIM(${c})) LIKE 'VAGO -%'
  )`;
}

module.exports = { isCessionarioVago, sqlCessionarioVagoExpr };
