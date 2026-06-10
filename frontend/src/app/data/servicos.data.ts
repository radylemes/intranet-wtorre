export interface Servico {
  titulo: string;
  desc: string;
  icon: 'alert' | 'search' | 'calendar' | 'report';
}

export const SERVICOS: Servico[] = [
  {
    titulo: 'Abertura de Chamados',
    desc: 'Solicite suporte de TI, facilities ou manutenção e acompanhe seus tickets.',
    icon: 'alert',
  },
  {
    titulo: 'Lista de Ramais',
    desc: 'Encontre colegas, áreas e telefones de todas as unidades do grupo.',
    icon: 'search',
  },
  {
    titulo: 'Agendas & Reservas',
    desc: 'Reserve salas de reunião, espaços e veja os calendários das equipes.',
    icon: 'calendar',
  },
  {
    titulo: 'Reportar Ocorrência',
    desc: 'Registre incidentes de segurança, compliance ou operacionais.',
    icon: 'report',
  },
];
