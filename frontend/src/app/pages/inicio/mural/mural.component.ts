import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ComunicadosService } from '../../../services/comunicados.service';
import { ContentRefreshService } from '../../../services/content-refresh.service';
import { EventosService } from '../../../services/eventos.service';
import { Comunicado } from '../../../models/comunicado.model';
import { Evento } from '../../../models/evento.model';

@Component({
  selector: 'app-mural',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './mural.component.html',
  styleUrl: './mural.component.scss',
})
export class MuralComponent implements OnInit {
  private readonly comunicadosService = inject(ComunicadosService);
  private readonly eventosService = inject(EventosService);
  private readonly contentRefresh = inject(ContentRefreshService);

  readonly noticias = signal<Comunicado[]>([]);
  readonly eventos = signal<Evento[]>([]);
  readonly carregandoEventos = signal(true);
  readonly imagemFalhou = signal<Set<string>>(new Set());

  constructor() {
    this.contentRefresh.comunicadosChanged$
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.carregarComunicados());
  }

  ngOnInit(): void {
    this.carregarComunicados();
    this.carregarEventos();
  }

  carregarComunicados(): void {
    this.comunicadosService.listar().subscribe({
      next: (list) => this.noticias.set(list),
      error: () => this.noticias.set([]),
    });
  }

  carregarEventos(): void {
    this.carregandoEventos.set(true);
    this.eventosService.listarProximos().subscribe({
      next: (res) => {
        this.eventos.set(res.eventos);
        this.carregandoEventos.set(false);
      },
      error: () => {
        this.eventos.set([]);
        this.carregandoEventos.set(false);
      },
    });
  }

  tituloEvento(ev: Evento): string {
    const tipo = ev.tipo?.trim();
    return tipo ? `${tipo} · ${ev.titulo}` : ev.titulo;
  }

  subtituloEvento(ev: Evento): string {
    const partes = [ev.dataTexto, ev.subtitulo].filter(Boolean);
    return partes.join(' · ');
  }

  mostrarImagem(ev: Evento): boolean {
    return Boolean(ev.imagemUrl) && !this.imagemFalhou().has(ev.titulo);
  }

  onImagemErro(ev: Evento): void {
    this.imagemFalhou.update((set) => {
      const next = new Set(set);
      next.add(ev.titulo);
      return next;
    });
  }
}
