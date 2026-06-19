export type TipoUnidade = 'camarote' | 'lounge';
export type SituacaoUnidade = 'vago' | 'vencido' | 'vence_breve' | 'ativo';
export type CadenciaAlerta = 'diaria' | 'semanal';
export type SyncFrequencia = '1h' | '6h' | '12h' | '24h' | 'semanal';

export interface CamaroteUnidade {
  id: number;
  tipo_unidade: TipoUnidade;
  andar: string | null;
  setor: string | null;
  numero: string;
  capacidade: number | null;
  cessionario: string | null;
  tipo_cessionario: string | null;
  primeira_locacao: string | null;
  inicio_locacao: string | null;
  final_locacao: string | null;
  valor_anual: number | null;
  valor_total: number | null;
  pack30: boolean;
  vagas_vvip: number | null;
  valor_vagas: number | null;
  situacao: SituacaoUnidade;
}

export interface SetorDisponiveis {
  numeros: string[];
  total: number;
}

export interface ResumoAlertas {
  vencidos: number;
  vence_breve: number;
  vagos: number;
  ativos: number;
  sem_data: number;
}

export interface MetricasFinanceiras {
  receita_anual: number;
  ticket_medio_anual: number;
  valor_medio_contrato: number;
  capacidade_total: number;
  media_por_unidade: number;
  qtd_ativos: number;
}

export interface TipoCessionarioResumo {
  resumo: Record<string, { quantidade: number; valor_total: number }>;
  por_andar: Record<string, Record<string, number>>;
}

export interface BlocoTipoUnidade {
  disponiveis_por_setor?: Record<string, SetorDisponiveis>;
  disponiveis?: number;
  alertas: ResumoAlertas;
  metricas: MetricasFinanceiras;
  tipo_cessionario: TipoCessionarioResumo;
  pack30: { com_pack30: number; sem_pack30: number };
  vagas_vvip: { total_vagas: number; valor_total: number };
}

export interface CamarotesDashboard {
  ultima_sync: string | null;
  dias_vence_breve: number;
  camarotes: BlocoTipoUnidade;
}

export interface CamarotesConfig {
  id: number;
  emails_alerta: string[];
  dias_vence_breve: number;
  cadencia: CadenciaAlerta;
  envio_ativo: boolean;
  sync_automatica: boolean;
  sync_frequencia: SyncFrequencia;
  ultimo_envio: string | null;
  ultima_sync: string | null;
}

export interface CamarotesSyncLog {
  id: number;
  tipo_unidade: TipoUnidade;
  executado_em: string;
  linhas_lidas: number;
  linhas_gravadas: number;
  status: 'ok' | 'erro';
  erro: string | null;
  duracao_ms: number;
}

export interface SyncResumo {
  resultados: Array<{
    tipo_unidade: TipoUnidade;
    label: string;
    linhas_lidas?: number;
    linhas_gravadas?: number;
    duracao_ms?: number;
    status: string;
    mensagem?: string;
  }>;
  erros: Array<{ tipo_unidade: TipoUnidade; mensagem: string }>;
  duracao_ms: number;
  ultima_sync: string | null;
}

export interface CamarotesVisualizador {
  usuario_id: number;
  nome_completo: string;
  email: string;
  departamento?: string | null;
  criado_em?: string;
}

export interface CamarotesAcesso {
  pode_visualizar: boolean;
}

export interface EnviarResumoResposta {
  enviado?: boolean;
  preview?: boolean;
  html?: string;
  total_itens?: number;
  destinatarios?: string[];
  enviados?: number;
  erros?: Array<{ email: string; mensagem: string }>;
  motivo?: string;
}
