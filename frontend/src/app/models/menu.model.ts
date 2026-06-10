export interface MenuItem {
  id: number;
  label: string;
  url: string | null;
  abrir_nova_aba: boolean;
  icone: string | null;
  cabecalho: string | null;
  ativo?: boolean;
  visivel_perfil?: string | null;
  children: MenuItem[];
}

export interface MenuItemPayload {
  label: string;
  url?: string | null;
  parent_id?: number | null;
  ordem?: number;
  abrir_nova_aba?: boolean;
  icone?: string | null;
  cabecalho?: string | null;
  ativo?: boolean;
  visivel_perfil?: string | null;
}

export interface MenuReorderItem {
  id: number;
  parent_id: number | null;
  ordem: number;
}
