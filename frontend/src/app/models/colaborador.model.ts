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
