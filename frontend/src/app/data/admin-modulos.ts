/**
 * Espelha a ordem de backend/src/config/modulos-admin.js (módulos com rota admin).
 * `colaboradores` fica de fora intencionalmente: gateia sync AD em Ramais & Contatos,
 * sem tela admin — ver docs/padrao-modulos-admin.md §1.
 */
export const ADMIN_MODULO_ROTAS: { codigo: string; rota: string }[] = [
  { codigo: 'menu', rota: 'menu' },
  { codigo: 'rodape', rota: 'rodape' },
  { codigo: 'documentos', rota: 'documentos' },
  { codigo: 'treinamentos', rota: 'treinamentos' },
  { codigo: 'containers', rota: 'containers' },
  { codigo: 'paginas', rota: 'paginas' },
  { codigo: 'tenants', rota: 'tenants' },
  { codigo: 'configuracoes', rota: 'configuracoes' },
  { codigo: 'camarotes', rota: 'camarotes' },
];

export function rotaParaModulo(path: string): string | null {
  const segment = path.split('/')[0];
  const found = ADMIN_MODULO_ROTAS.find((m) => m.rota === segment);
  return found?.codigo ?? null;
}
