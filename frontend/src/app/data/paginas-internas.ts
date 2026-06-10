/**
 * Páginas internas navegáveis da intranet (rotas de usuário).
 * Ao criar uma nova página no app:
 * 1. Registre a rota em app.routes.ts
 * 2. Adicione uma entrada aqui para aparecer no gerenciador de menu
 *
 * Melhoria futura: popular também categorias de documentos (/documentos/:slug)
 * a partir da API de categorias.
 */
export interface PaginaInterna {
  path: string;
  label: string;
}

export const PAGINAS_INTERNAS: PaginaInterna[] = [
  { path: '/inicio', label: 'Início' },
  { path: '/documentos', label: 'Documentos' },
  { path: '/ramais', label: 'Ramais' },
  { path: '/aniversariantes', label: 'Aniversariantes' },
  { path: '/assinaturas', label: 'Assinaturas de E-mail' },
];

export function findPaginaInterna(path: string): PaginaInterna | undefined {
  return PAGINAS_INTERNAS.find((p) => p.path === path);
}

export function isPaginaInternaConhecida(path: string): boolean {
  return PAGINAS_INTERNAS.some((p) => p.path === path);
}
