export interface Colaborador {
  id: number;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  email: string | null;
  celular: string | null;
  ramal: string | null;
  telefone_fixo?: string | null;
  nasc_dia?: number | null;
  nasc_mes?: number | null;
  empresa: string | null;
  tenant_id: number | null;
  /** null = desconhecido; false = sem foto confirmada; true = com foto */
  tem_foto: boolean | null;
}

export interface ColaboradorIntranetLink {
  cadastrado: boolean;
  usuario_id: number | null;
}

export interface ColaboradorAdmin extends Colaborador {
  ad_id?: string;
  ativo: boolean;
  sincronizado_em: string | null;
  nasc_ano?: number | null;
  tenant_nome?: string | null;
  intranet: ColaboradorIntranetLink;
}

export interface ColaboradoresAdminResposta {
  colaboradores: ColaboradorAdmin[];
  total: number;
  page: number;
  limit: number;
}

export interface ColaboradoresStats {
  ativos: number;
  inativos: number;
  ultima_sync: string | null;
  sync_em_andamento: boolean;
}

export interface ColaboradoresSyncResumo {
  tenants: {
    tenant: string;
    tenant_id: number;
    sincronizados: number;
    inativados: number;
    ignorados: number;
    erro?: string;
  }[];
  total: number;
  erros: { tenant: string; mensagem: string }[];
  duracao_ms?: number;
  sincronizado_em?: string | null;
}

export interface ColaboradoresAdminFiltros {
  busca?: string;
  empresa?: string;
  departamento?: string;
  ativo?: '1' | '0' | 'todos';
  page?: number;
  limit?: number;
}

export interface DiretorioResposta {
  colaboradores: Colaborador[];
  sincronizado_em: string | null;
}

export type EmpresaClasse = 'wtorre' | 'nubank' | 'base' | 'novo' | 'neutro';

export interface Aniversariante {
  id: number;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  empresa: string | null;
  nasc_dia: number;
  nasc_mes: number;
  tem_foto: boolean | null;
}

export interface AniversariantesResposta {
  aniversariantes: Aniversariante[];
  mes: number;
}
