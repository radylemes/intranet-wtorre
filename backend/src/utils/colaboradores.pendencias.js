function isVazio(val) {
  return val == null || String(val).trim() === '';
}

function computePendencias(c) {
  const p = [];
  if (isVazio(c.cargo)) p.push('cargo');
  if (isVazio(c.empresa)) p.push('empresa');
  if (isVazio(c.ramal)) p.push('ramal');
  if (isVazio(c.celular)) p.push('celular');
  if (isVazio(c.telefone_fixo)) p.push('telefone_fixo');
  if (c.nasc_dia == null || c.nasc_mes == null) p.push('aniversario');
  if (isVazio(c.ramal) && isVazio(c.celular) && isVazio(c.telefone_fixo)) {
    p.push('sem_contato');
  }
  return p;
}

function sqlIncompletosCondition(alias = 'c') {
  const a = alias;
  return `(
    (${a}.cargo IS NULL OR TRIM(${a}.cargo) = '')
    OR (${a}.empresa IS NULL OR TRIM(${a}.empresa) = '')
    OR (${a}.ramal IS NULL OR TRIM(${a}.ramal) = '')
    OR (${a}.celular IS NULL OR TRIM(${a}.celular) = '')
    OR (${a}.telefone_fixo IS NULL OR TRIM(${a}.telefone_fixo) = '')
    OR (${a}.nasc_dia IS NULL OR ${a}.nasc_mes IS NULL)
  )`;
}

module.exports = {
  isVazio,
  computePendencias,
  sqlIncompletosCondition,
};
