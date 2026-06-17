const { MODULOS, isCodigoValido, todosCodigos } = require('../config/modulos-admin');
const permissoesRepo = require('../repositories/permissoes.repository');
const usersRepo = require('../repositories/users.repository');
const colaboradoresRepo = require('../repositories/colaboradores.repository');

const CACHE_TTL_MS = 60_000;
const cache = new Map();

function getCachedModulos(usuarioId) {
  const entry = cache.get(usuarioId);
  if (!entry) return null;
  if (Date.now() > entry.expira) {
    cache.delete(usuarioId);
    return null;
  }
  return entry.modulos;
}

function setCachedModulos(usuarioId, modulos) {
  cache.set(usuarioId, { modulos, expira: Date.now() + CACHE_TTL_MS });
}

function invalidarCache(usuarioId) {
  cache.delete(usuarioId);
}

async function invalidarCachePorPerfil(perfilId) {
  const usuarioIds = await permissoesRepo.listarUsuariosAfetadosPorPerfil(perfilId);
  for (const id of usuarioIds) {
    invalidarCache(id);
  }
}

async function resolveModulos(user) {
  if (!user) return [];
  if (user.perfil === 'ADMIN') {
    return todosCodigos();
  }

  const cached = getCachedModulos(user.id);
  if (cached) return cached;

  const modulos = await permissoesRepo.resolverModulosDoUsuario(user.id);
  setCachedModulos(user.id, modulos);
  return modulos;
}

function validarCodigosModulos(codigos) {
  const invalidos = codigos.filter((c) => !isCodigoValido(c));
  if (invalidos.length) {
    const err = new Error(`Módulos inválidos: ${invalidos.join(', ')}`);
    err.status = 400;
    throw err;
  }
}

async function provisionarUsuarioDeColaborador(colaboradorId) {
  const colaborador = await colaboradoresRepo.findById(colaboradorId);
  if (!colaborador || !colaborador.ad_id) {
    const err = new Error('Colaborador não encontrado.');
    err.status = 404;
    throw err;
  }

  let user = await usersRepo.findByMicrosoftId(colaborador.ad_id);
  if (user) return user;

  if (colaborador.email) {
    const byEmail = await usersRepo.findByEmail(colaborador.email);
    if (byEmail) {
      return usersRepo.linkMicrosoft(
        byEmail.id,
        colaborador.ad_id,
        colaborador.nome,
        colaborador.departamento
      );
    }
  }

  if (!colaborador.email) {
    const err = new Error('Colaborador sem e-mail cadastrado no AD.');
    err.status = 400;
    throw err;
  }

  return usersRepo.createMicrosoftUser({
    email: colaborador.email,
    nome: colaborador.nome,
    departamento: colaborador.departamento,
    microsoftId: colaborador.ad_id,
    username: colaborador.email.split('@')[0],
  });
}

function listarModulosCatalogo() {
  return MODULOS.map(({ codigo, nome, ordem }) => ({
    codigo,
    nome,
    ordem,
  }));
}

module.exports = {
  resolveModulos,
  invalidarCache,
  invalidarCachePorPerfil,
  validarCodigosModulos,
  provisionarUsuarioDeColaborador,
  listarModulosCatalogo,
  CACHE_TTL_MS,
};
