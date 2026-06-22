import { Sistema } from '../data/sistemas.data';

export type HomeSistemaIcon = Sistema['icon'];

export interface HomeSistemaItem {
  id: string;
  nome: string;
  subtitulo: string;
  icon: HomeSistemaIcon;
  url: string | null;
  abrirNovaAba: boolean;
  ordem: number;
  ativo: boolean;
}

export interface HomeSistemasConfig {
  tag: string;
  titulo: string;
  linkTodos: string | null;
  linkTodosNovaAba: boolean;
  itens: HomeSistemaItem[];
}

export const HOME_SISTEMA_ICONES: { value: HomeSistemaIcon; label: string }[] = [
  { value: 'user', label: 'Usuário' },
  { value: 'wallet', label: 'Carteira' },
  { value: 'badge', label: 'Credencial' },
  { value: 'database', label: 'Banco de dados' },
  { value: 'cloud', label: 'Nuvem' },
  { value: 'check', label: 'Check' },
  { value: 'task', label: 'Tarefa' },
  { value: 'building', label: 'Prédio' },
  { value: 'phone', label: 'Telefone' },
];

export const HOME_SISTEMAS_DEFAULTS: HomeSistemasConfig = {
  tag: 'Acesso rápido',
  titulo: 'Sistemas Corporativos',
  linkTodos: null,
  linkTodosNovaAba: false,
  itens: [],
};
