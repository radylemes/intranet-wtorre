export interface Evento {
  emoji: string;
  titulo: string;
  subtitulo: string;
  tag: string;
}

export const EVENTOS: Evento[] = [
  {
    emoji: '🎤',
    titulo: 'Show · Arena Nubank Parque',
    subtitulo: 'Sáb, 31 mai · operação de eventos',
    tag: 'Escala',
  },
  {
    emoji: '⚽',
    titulo: 'Jogo · Brasileirão',
    subtitulo: 'Qua, 04 jun · 21h30',
    tag: 'Escala',
  },
  {
    emoji: '🤝',
    titulo: 'Open House · Base Coworking',
    subtitulo: 'Sex, 06 jun · 18h',
    tag: 'Aberto',
  },
];
