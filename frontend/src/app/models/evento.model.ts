export interface Evento {
  fonteCodigo: string;
  fonteNome: string;
  tipo: string;
  titulo: string;
  subtitulo: string | null;
  dataTexto: string;
  dataIso: string | null;
  url: string | null;
  imagemUrl: string | null;
  emoji: string;
}

export interface EventosProximosResponse {
  eventos: Evento[];
  atualizadoEm: string;
  fontes: string[];
}

export type EventosAgendaResponse = EventosProximosResponse;

export interface EventoFonte {
  id: number;
  codigo: string;
  nome: string;
  url: string;
  parserTipo: string;
  ativo: boolean;
  ordem: number;
  limite: number | null;
  configJson: Record<string, unknown> | null;
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface EventoParserTipo {
  codigo: string;
  nome: string;
  descricao: string;
}

export interface EventoFontePayload {
  codigo?: string;
  nome: string;
  url: string;
  parserTipo: string;
  ativo: boolean;
  ordem: number;
  limite: number | null;
}

export interface EventoFonteTesteResponse {
  fonte: Pick<EventoFonte, 'id' | 'codigo' | 'nome' | 'url' | 'parserTipo'>;
  total: number;
  eventos: Evento[];
  testadoEm: string;
}
