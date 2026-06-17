export interface CategoriaTreinamento {
  label: string;
  cor: string;
  grad: string;
}

export const CAT: Record<string, CategoriaTreinamento> = {
  onboarding: {
    label: 'Onboarding',
    cor: '#1d54e6',
    grad: 'linear-gradient(135deg,#2f6bff,#15308f)',
  },
  compliance: {
    label: 'Compliance',
    cor: '#8a05be',
    grad: 'linear-gradient(135deg,#a23bd6,#5e0a85)',
  },
  ti: {
    label: 'TI & Sistemas',
    cor: '#0e8da0',
    grad: 'linear-gradient(135deg,#15a8bd,#0a5e6c)',
  },
  seguranca: {
    label: 'Segurança',
    cor: '#e0a52e',
    grad: 'linear-gradient(135deg,#eab43f,#b9791a)',
  },
  operacoes: {
    label: 'Operações',
    cor: '#1c9e62',
    grad: 'linear-gradient(135deg,#27b873,#127a4a)',
  },
  rh: {
    label: 'RH',
    cor: '#d8456e',
    grad: 'linear-gradient(135deg,#e85f86,#a92750)',
  },
};

export const CATEGORIAS_LISTA = Object.entries(CAT).map(([slug, c]) => ({
  slug,
  ...c,
}));

const CONTAINER_RE = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;

export function categoriaGrad(slug: string): string {
  return CAT[slug]?.grad ?? CAT['onboarding'].grad;
}

export function categoriaCor(slug: string): string {
  return CAT[slug]?.cor ?? CAT['onboarding'].cor;
}

export function categoriaLabel(slug: string): string {
  return CAT[slug]?.label ?? slug;
}

export function formatarDuracao(seg?: number | null): string {
  if (seg == null || seg < 0) return '—';
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function parseDuracaoInput(val: string): number | null {
  const t = val.trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  const m = t.match(/^(\d{1,3}):(\d{2})$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  return null;
}

export function validarNomeContainer(nome: string): string | null {
  const trimmed = nome.trim().toLowerCase();
  if (trimmed.length < 3 || trimmed.length > 63) {
    return 'Nome deve ter entre 3 e 63 caracteres.';
  }
  if (!CONTAINER_RE.test(trimmed) || trimmed.includes('--')) {
    return 'Use minúsculas, números e hífens; comece e termine com letra ou número; sem hífens duplos.';
  }
  return null;
}

export function mapTreinamentoApi(row: Record<string, unknown>): import('../models/treinamento.model').Treinamento {
  return {
    id: row['id'] as number,
    titulo: row['titulo'] as string,
    descricao: (row['descricao'] as string) ?? null,
    categoria: row['categoria'] as string,
    area: (row['area'] as string) ?? null,
    duracaoSeg: (row['duracao_seg'] as number) ?? null,
    destaque: !!(row['destaque'] as boolean),
    temThumb: !!(row['tem_thumb'] as boolean),
  };
}
