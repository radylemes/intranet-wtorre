const CATEGORIAS_PERMITIDAS = new Set([
  'onboarding',
  'compliance',
  'ti',
  'seguranca',
  'operacoes',
  'rh',
]);

function validarCategoria(categoria) {
  if (!categoria || typeof categoria !== 'string') {
    return { ok: false, mensagem: 'Categoria é obrigatória.' };
  }
  const slug = categoria.trim().toLowerCase();
  if (!CATEGORIAS_PERMITIDAS.has(slug)) {
    return { ok: false, mensagem: 'Categoria inválida.' };
  }
  return { ok: true, categoria: slug };
}

function parseDuracaoSeg(val) {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number' && Number.isFinite(val)) return Math.max(0, Math.floor(val));
  const s = String(val).trim();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const mmss = s.match(/^(\d{1,3}):(\d{2})$/);
  if (mmss) {
    return parseInt(mmss[1], 10) * 60 + parseInt(mmss[2], 10);
  }
  return null;
}

module.exports = { validarCategoria, parseDuracaoSeg, CATEGORIAS_PERMITIDAS };
