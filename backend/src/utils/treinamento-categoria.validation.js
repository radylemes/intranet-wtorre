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

function parseCategoriaId(body) {
  const raw =
    body.categoria_id != null
      ? body.categoria_id
      : body.categoriaId != null
        ? body.categoriaId
        : undefined;
  if (raw === undefined) return undefined;
  if (raw === '' || raw === null || raw === 'null') return null;
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) {
    const err = new Error('categoria_id inválido.');
    err.status = 400;
    throw err;
  }
  return id;
}

function parsePaginaId(body) {
  const raw =
    body.pagina_id != null ? body.pagina_id : body.paginaId != null ? body.paginaId : undefined;
  if (raw === undefined || raw === '' || raw === null) {
    const err = new Error('pagina_id é obrigatório.');
    err.status = 400;
    throw err;
  }
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) {
    const err = new Error('pagina_id inválido.');
    err.status = 400;
    throw err;
  }
  return id;
}

module.exports = { parseDuracaoSeg, parseCategoriaId, parsePaginaId };
