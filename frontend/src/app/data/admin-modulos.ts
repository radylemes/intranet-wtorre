/** Espelha a ordem de backend/src/config/modulos-admin.js */
export const ADMIN_MODULO_ROTAS: { codigo: string; rota: string }[] = [
  { codigo: 'menu', rota: 'menu' },
  { codigo: 'documentos', rota: 'documentos' },
  { codigo: 'treinamentos', rota: 'treinamentos' },
  { codigo: 'containers', rota: 'containers' },
  { codigo: 'tenants', rota: 'tenants' },
  { codigo: 'configuracoes', rota: 'configuracoes' },
];

export function rotaParaModulo(path: string): string | null {
  const found = ADMIN_MODULO_ROTAS.find((m) => m.rota === path);
  return found?.codigo ?? null;
}
