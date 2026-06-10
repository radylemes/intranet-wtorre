export interface Noticia {
  dia: string;
  mes: string;
  categoria: string;
  catClasse: 'rh' | 'ti' | 'ev' | 'com';
  titulo: string;
}

export const NOTICIAS: Noticia[] = [
  {
    dia: '28',
    mes: 'Mai',
    categoria: 'Recursos Humanos',
    catClasse: 'rh',
    titulo: 'Inscrições abertas para o programa de mentoria interna do grupo',
  },
  {
    dia: '26',
    mes: 'Mai',
    categoria: 'Tecnologia',
    catClasse: 'ti',
    titulo: 'Manutenção programada do Oracle EBS no sábado, das 22h às 02h',
  },
  {
    dia: '24',
    mes: 'Mai',
    categoria: 'Nubank Parque',
    catClasse: 'ev',
    titulo: 'Novo fluxo de credenciamento para dias de jogo já disponível',
  },
  {
    dia: '21',
    mes: 'Mai',
    categoria: 'Compliance',
    catClasse: 'com',
    titulo: 'Atualização da Política de Privacidade e Segurança da Informação',
  },
];
