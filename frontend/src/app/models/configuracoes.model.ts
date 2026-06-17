export interface HeaderChamadoConfig {
  label: string;
  url: string | null;
  ativo: boolean;
  abrir_nova_aba: boolean;
  tipo_destino: 'interna' | 'externa';
}

export interface ConfiguracoesAdmin {
  header_chamado: HeaderChamadoConfig;
}
