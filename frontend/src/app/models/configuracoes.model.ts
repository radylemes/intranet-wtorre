export interface HeaderChamadoConfig {
  label: string;
  url: string | null;
  ativo: boolean;
  abrir_nova_aba: boolean;
  tipo_destino: 'interna' | 'externa';
}

export type EmailProvider = 'smtp' | 'acs';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  has_password: boolean;
  from_email: string;
  from_name: string;
  ativo: boolean;
  atualizado_em?: string;
}

export interface EmailConfig extends SmtpConfig {
  provider: EmailProvider;
  has_acs_connection_string: boolean;
  acs_sender: string;
  ocultar_para: boolean;
}

export interface ConfiguracoesAdmin {
  header_chamado: HeaderChamadoConfig;
}
