export interface Treinamento {
  id: number;
  titulo: string;
  descricao?: string | null;
  categoria: string;
  area?: string | null;
  duracaoSeg?: number | null;
  destaque: boolean;
  temThumb: boolean;
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
