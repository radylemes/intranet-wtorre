#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const permissoesRepo = require(path.join(__dirname, '..', 'src/repositories/permissoes.repository'));
const permissoesService = require(path.join(__dirname, '..', 'src/services/permissoes.service'));
const usersRepo = require(path.join(__dirname, '..', 'src/repositories/users.repository'));
const { todosCodigos } = require(path.join(__dirname, '..', 'src/config/modulos-admin'));

async function main() {
  const failures = [];

  const modulos = permissoesService.listarModulosCatalogo();
  if (modulos.length !== 6) {
    failures.push(`Esperado 6 módulos no catálogo, obteve ${modulos.length}`);
  }

  const admin = await usersRepo.findByEmail(process.env.ADMIN_EMAIL || 'admin@grupowtorre.com');
  if (!admin) {
    failures.push('Admin seed não encontrado');
  } else {
    const adminMods = await permissoesService.resolveModulos(admin);
    if (adminMods.length !== todosCodigos().length) {
      failures.push(`ADMIN deveria ter todos os módulos (${todosCodigos().length}), obteve ${adminMods.length}`);
    }
  }

  const perfil = await permissoesRepo.createPerfil({
    nome: `_smoke_${Date.now()}`,
    descricao: 'teste',
    ativo: true,
  });
  await permissoesRepo.setModulosDoPerfil(perfil.id, ['menu', 'documentos']);

  const inativo = await permissoesRepo.createPerfil({
    nome: `_smoke_inativo_${Date.now()}`,
    ativo: false,
  });
  await permissoesRepo.setModulosDoPerfil(inativo.id, ['tenants']);

  const testUser = await usersRepo.createMicrosoftUser({
    email: `smoke_${Date.now()}@test.local`,
    nome: 'Smoke Test',
    departamento: 'TI',
    microsoftId: `smoke-oid-${Date.now()}`,
    username: 'smoke',
  });

  await permissoesRepo.setPerfisDoUsuario(testUser.id, [perfil.id, inativo.id]);
  await permissoesRepo.setModulosExtra(testUser.id, ['containers']);

  let mods = await permissoesRepo.resolverModulosDoUsuario(testUser.id);
  const expected = ['containers', 'documentos', 'menu'].sort();
  const got = [...mods].sort();
  if (JSON.stringify(got) !== JSON.stringify(expected)) {
    failures.push(`Resolução com perfil inativo falhou: esperado ${expected}, obteve ${got}`);
  }

  await permissoesRepo.updatePerfil(inativo.id, {
    nome: inativo.nome,
    descricao: null,
    ativo: true,
  });
  mods = await permissoesRepo.resolverModulosDoUsuario(testUser.id);
  if (!mods.includes('tenants')) {
    failures.push('Perfil ativado deveria conceder tenants');
  }

  await permissoesRepo.setPerfisDoUsuario(testUser.id, [perfil.id]);
  await usersRepo.setAtivo(testUser.id, false);
  const inativoUser = await usersRepo.findById(testUser.id);
  if (inativoUser.ativo) {
    failures.push('setAtivo(false) não funcionou');
  }

  const vinculados = await permissoesRepo.contarUsuariosDoPerfil(perfil.id);
  if (vinculados < 1) {
    failures.push('contarUsuariosDoPerfil deveria ser >= 1');
  }

  await permissoesRepo.deletePerfil(inativo.id);

  permissoesService.invalidarCache(testUser.id);
  await permissoesService.invalidarCachePorPerfil(perfil.id);

  await permissoesRepo.deletePerfil(perfil.id);
  await usersRepo.setAtivo(testUser.id, false);

  if (failures.length) {
    console.error('SMOKE FALHOU:');
    failures.forEach((f) => console.error(' -', f));
    process.exit(1);
  }

  console.log('SMOKE OK: catálogo, ADMIN short-circuit, perfil.ativo filtro, resolução, contagem');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
