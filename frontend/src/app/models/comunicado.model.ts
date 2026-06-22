export type ComunicadoCategoria = 'rh' | 'ti' | 'ev' | 'com';

export interface Comunicado {
  id: number;
  titulo: string;
  categoria: ComunicadoCategoria;
  categoriaLabel: string;
  catClasse: ComunicadoCategoria;
  dia: string;
  mes: string;
  dataPublicacao: string;
}

export interface ComunicadoAdmin extends Comunicado {
  ordem: number | null;
  ativo: boolean;
  criado_por: number | null;
  criado_em: string;
  atualizado_em: string;
}

export interface ComunicadoPayload {
  titulo: string;
  categoria: ComunicadoCategoria;
  dataPublicacao: string;
  ordem?: number | null;
  ativo?: boolean;
}
