export interface Treinamento {
  id: number;
  titulo: string;
  descricao?: string | null;
  area?: string | null;
  duracaoSeg?: number | null;
  destaque: boolean;
  temThumb: boolean;
  paginaId: number;
  paginaSlug: string;
  paginaNome?: string | null;
  categoriaId?: number | null;
  categoriaNome?: string | null;
  categoriaSlug?: string | null;
  categoriaIcone?: string | null;
  temCategoria: boolean;
}

export interface TreinamentoAdmin extends Treinamento {
  container: string;
  ativo: boolean;
  ordem?: number | null;
  criado_em?: string;
  atualizado_em?: string;
}

export interface TreinamentoDetalhe extends TreinamentoAdmin {
  blob_name?: string;
  thumb_blob?: string | null;
  criado_por?: string | null;
}

export interface PlaybackResp {
  url: string;
  expiraEm: string;
}
