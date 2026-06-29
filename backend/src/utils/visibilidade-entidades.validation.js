const paginaRepo = require('../repositories/documentos-paginas.repository');
const catRepo = require('../repositories/categorias-documentos.repository');

function parseVisibilidadesInput(body) {
  if (!body) return null;
  let raw = body.visibilidades;
  if (raw == null || raw === '') return null;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      const err = new Error('visibilidades deve ser um JSON válido.');
      err.status = 400;
      throw err;
    }
  }
  if (!Array.isArray(raw)) {
    const err = new Error('visibilidades deve ser um array.');
    err.status = 400;
    throw err;
  }
  return raw;
}

function visibilidadesFromLegacy(paginaId, categoriaId) {
  if (paginaId == null) return [];
  return [{ pagina_id: Number(paginaId), categoria_id: categoriaId != null ? Number(categoriaId) : null }];
}

async function normalizarVisibilidades(rawList, { categoriaOpcional = false } = {}) {
  if (!Array.isArray(rawList) || !rawList.length) {
    const err = new Error('Informe ao menos uma entidade com categoria.');
    err.status = 400;
    throw err;
  }

  const seen = new Set();
  const result = [];

  for (const item of rawList) {
    const paginaId = Number(item.pagina_id ?? item.paginaId);
    const categoriaIdRaw = item.categoria_id ?? item.categoriaId;
    const categoriaId =
      categoriaIdRaw === '' || categoriaIdRaw == null ? null : Number(categoriaIdRaw);

    if (!paginaId || !Number.isFinite(paginaId)) {
      const err = new Error('pagina_id inválido em visibilidades.');
      err.status = 400;
      throw err;
    }
    if (seen.has(paginaId)) {
      const err = new Error('Entidade duplicada em visibilidades.');
      err.status = 400;
      throw err;
    }
    seen.add(paginaId);

    const pagina = await paginaRepo.findById(paginaId);
    if (!pagina || !pagina.ativo) {
      const err = new Error(`Entidade inválida ou inativa (id ${paginaId}).`);
      err.status = 400;
      throw err;
    }

    if (categoriaId == null || !Number.isFinite(categoriaId)) {
      if (categoriaOpcional) {
        result.push({ pagina_id: paginaId, categoria_id: null });
        continue;
      }
      const err = new Error(`Categoria obrigatória para entidade ${pagina.nome}.`);
      err.status = 400;
      throw err;
    }

    const cat = await catRepo.findById(categoriaId);
    if (!cat || !cat.ativo) {
      const err = new Error('Categoria inválida ou inativa.');
      err.status = 400;
      throw err;
    }
    if (cat.pagina_id !== paginaId) {
      const err = new Error(`Categoria deve pertencer à entidade ${pagina.nome}.`);
      err.status = 400;
      throw err;
    }

    result.push({ pagina_id: paginaId, categoria_id: categoriaId });
  }

  return result;
}

async function resolveVisibilidadesFromBody(
  body,
  legacyPaginaId,
  legacyCategoriaId,
  options = {}
) {
  const parsed = parseVisibilidadesInput(body);
  if (parsed) {
    return normalizarVisibilidades(parsed, options);
  }
  if (legacyPaginaId != null) {
    return normalizarVisibilidades(visibilidadesFromLegacy(legacyPaginaId, legacyCategoriaId), options);
  }
  const err = new Error('Informe visibilidades (entidades e categorias).');
  err.status = 400;
  throw err;
}

module.exports = {
  parseVisibilidadesInput,
  visibilidadesFromLegacy,
  normalizarVisibilidades,
  resolveVisibilidadesFromBody,
};
