const { sqlCessionarioVagoExpr, isCessionarioVago } = require('./camarotes-cessionario.util');

function sqlSituacaoExpr(tableAlias = '') {
  const p = tableAlias ? `${tableAlias}.` : '';
  return `(CASE
    WHEN ${sqlCessionarioVagoExpr(tableAlias || '')} THEN 'vago'
    WHEN ${p}final_locacao IS NULL THEN 'ativo'
    WHEN ${p}final_locacao < CURDATE() THEN 'vencido'
    WHEN ${p}final_locacao <= DATE_ADD(CURDATE(), INTERVAL ? DAY) THEN 'vence_breve'
    ELSE 'ativo'
  END)`;
}

function diasRestantes(finalLocacao) {
  if (!finalLocacao) return null;
  const s = String(finalLocacao).slice(0, 10);
  const parts = s.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  const finalMs = Date.UTC(y, m - 1, d);
  const now = new Date();
  const hojeMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((finalMs - hojeMs) / (1000 * 60 * 60 * 24));
}

/** @deprecated Use sqlSituacaoExpr + CURDATE() nas queries SQL. */
function derivarSituacao(unidade, diasVenceBreve = 90) {
  if (isCessionarioVago(unidade.cessionario)) return 'vago';
  if (!unidade.final_locacao) return 'ativo';
  const dias = diasRestantes(unidade.final_locacao);
  if (dias == null) return 'ativo';
  if (dias < 0) return 'vencido';
  if (dias <= diasVenceBreve) return 'vence_breve';
  return 'ativo';
}

module.exports = {
  sqlSituacaoExpr,
  diasRestantes,
  derivarSituacao,
};
