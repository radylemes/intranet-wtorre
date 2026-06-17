const PAGINAS_INTERNAS = [
  { path: '/inicio', label: 'Início' },
  { path: '/documentos', label: 'Documentos' },
  { path: '/ramais', label: 'Ramais' },
  { path: '/aniversariantes', label: 'Aniversariantes' },
  { path: '/treinamentos', label: 'Treinamentos' },
  { path: '/assinaturas', label: 'Assinaturas de E-mail' },
];

const PATHS = new Set(PAGINAS_INTERNAS.map((p) => p.path));

function isPaginaInterna(path) {
  return PATHS.has(path);
}

module.exports = { PAGINAS_INTERNAS, isPaginaInterna };
