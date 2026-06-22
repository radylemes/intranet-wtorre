import { ComunicadoCategoria } from '../models/comunicado.model';

export interface ComunicadoCategoriaOption {
  codigo: ComunicadoCategoria;
  label: string;
}

export const COMUNICADO_CATEGORIAS: ComunicadoCategoriaOption[] = [
  { codigo: 'rh', label: 'Recursos Humanos' },
  { codigo: 'ti', label: 'Tecnologia' },
  { codigo: 'ev', label: 'Nubank Parque' },
  { codigo: 'com', label: 'Compliance' },
];

export function labelCategoria(codigo: ComunicadoCategoria): string {
  return COMUNICADO_CATEGORIAS.find((c) => c.codigo === codigo)?.label ?? codigo;
}

export function formatarDataExibicao(isoDate: string): string {
  if (!isoDate) return '—';
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}
