const MODULOS = [
  { codigo: 'menu', nome: 'Gestão do Menu', ordem: 1 },
  { codigo: 'documentos', nome: 'Documentos', ordem: 2 },
  { codigo: 'treinamentos', nome: 'Treinamentos', ordem: 3 },
  { codigo: 'containers', nome: 'Containers', ordem: 4 },
  { codigo: 'tenants', nome: 'Tenants Azure', ordem: 5 },
  { codigo: 'colaboradores', nome: 'Sincronização AD', ordem: 6 },
  { codigo: 'configuracoes', nome: 'Configurações', ordem: 7 },
];

const CODIGOS = new Set(MODULOS.map((m) => m.codigo));

function isCodigoValido(codigo) {
  return CODIGOS.has(codigo);
}

function todosCodigos() {
  return MODULOS.map((m) => m.codigo);
}

module.exports = { MODULOS, CODIGOS, isCodigoValido, todosCodigos };
