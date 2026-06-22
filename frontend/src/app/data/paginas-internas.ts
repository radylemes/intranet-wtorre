/**
 * Páginas internas navegáveis da intranet (rotas de usuário).
 * Ao criar uma nova página no app:
 * 1. Registre a rota em app.routes.ts
 * 2. Adicione uma entrada aqui para aparecer no gerenciador de menu
 *
 * Categorias de documentos (/documentos/:slug) são aceitas dinamicamente via isPaginaInternaConhecida.
 */
export interface PaginaInterna {
  path: string;
  label: string;
}

const DOCUMENTOS_PATH_REGEX = /^\/documentos(\/[a-z0-9-]+)?$/;
export const PAGINA_PUBLICA_REGEX = /^\/p\/[a-z0-9-]+$/;

export const PAGINAS_INTERNAS: PaginaInterna[] = [
  { path: '/inicio', label: 'Início' },
  { path: '/documentos', label: 'Documentos' },
  { path: '/ramais', label: 'Ramais' },
  { path: '/aniversariantes', label: 'Aniversariantes' },
  { path: '/treinamentos', label: 'Treinamentos' },
  { path: '/assinaturas', label: 'Assinaturas de E-mail' },
  { path: '/solicitacao-colaborador', label: 'Solicitação de Colaborador' },
  { path: '/bi/camarotes', label: 'BI / Camarotes' },
];

export function paginasDocumentosFromCategorias(categoriasRaiz: { slug: string; nome: string }[]): PaginaInterna[] {
  return categoriasRaiz.map((c) => ({
    path: `/documentos/${c.slug}`,
    label: `Documentos / ${c.nome}`,
  }));
}

export function paginasPublicasFromApi(
  paginas: { slug: string; titulo: string }[] = []
): PaginaInterna[] {
  return paginas.map((p) => ({
    path: `/p/${p.slug}`,
    label: p.titulo,
  }));
}

export function buildPaginasInternasLista(
  categoriasRaiz: { slug: string; nome: string }[] = [],
  paginasPublicas: { slug: string; titulo: string }[] = []
): PaginaInterna[] {
  const docPaginas = paginasDocumentosFromCategorias(categoriasRaiz).sort((a, b) =>
    a.label.localeCompare(b.label, 'pt-BR')
  );
  const result: PaginaInterna[] = [];

  for (const pagina of PAGINAS_INTERNAS) {
    result.push(pagina);
    if (pagina.path === '/documentos') {
      result.push(...docPaginas);
    }
  }

  const cmsPaginas = paginasPublicasFromApi(paginasPublicas).sort((a, b) =>
    a.label.localeCompare(b.label, 'pt-BR')
  );
  result.push(...cmsPaginas);

  return result;
}

export function findPaginaInterna(
  path: string,
  categoriasRaiz: { slug: string; nome: string }[] = [],
  paginasPublicas: { slug: string; titulo: string }[] = []
): PaginaInterna | undefined {
  const lista = buildPaginasInternasLista(categoriasRaiz, paginasPublicas);
  const found = lista.find((p) => p.path === path);
  if (found) return found;

  if (DOCUMENTOS_PATH_REGEX.test(path) && path !== '/documentos') {
    const categoria = categoriasRaiz.find((c) => `/documentos/${c.slug}` === path);
    const slug = path.replace('/documentos/', '');
    return { path, label: categoria ? `Documentos / ${categoria.nome}` : `Documentos / ${slug}` };
  }

  if (PAGINA_PUBLICA_REGEX.test(path)) {
    const slug = path.replace('/p/', '');
    const pagina = paginasPublicas.find((p) => p.slug === slug);
    return { path, label: pagina?.titulo ?? `Página / ${slug}` };
  }

  return undefined;
}

export function isPaginaInternaConhecida(path: string): boolean {
  return (
    PAGINAS_INTERNAS.some((p) => p.path === path) ||
    DOCUMENTOS_PATH_REGEX.test(path) ||
    PAGINA_PUBLICA_REGEX.test(path)
  );
}
