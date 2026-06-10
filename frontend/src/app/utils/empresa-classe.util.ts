import { EmpresaClasse } from '../models/colaborador.model';

/** Nomes canônicos vindos de empresa_dominios (backend). */
const CANONICAL: Record<string, EmpresaClasse> = {
  WTorre: 'wtorre',
  'Nubank Parque': 'nubank',
  'Base Coworking': 'base',
  'Novo Anhangabaú': 'novo',
};

export function empresaParaClasse(empresa: string | null | undefined): EmpresaClasse {
  if (!empresa) return 'neutro';
  if (CANONICAL[empresa]) return CANONICAL[empresa];
  return 'neutro';
}

/** Empresas distintas para chips de filtro (sem nulos). */
export function empresasDistintas(colaboradores: { empresa: string | null }[]): string[] {
  const set = new Set<string>();
  for (const c of colaboradores) {
    if (c.empresa) set.add(c.empresa);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function labelEmpresa(empresa: string | null | undefined): string {
  return empresa || 'Outros';
}
