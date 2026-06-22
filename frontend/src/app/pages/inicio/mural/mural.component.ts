import { Component, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EVENTOS } from '../../../data/eventos.data';
import { ComunicadosService } from '../../../services/comunicados.service';
import { ContentRefreshService } from '../../../services/content-refresh.service';
import { Comunicado } from '../../../models/comunicado.model';

@Component({
  selector: 'app-mural',
  standalone: true,
  templateUrl: './mural.component.html',
  styleUrl: './mural.component.scss',
})
export class MuralComponent implements OnInit {
  private readonly comunicadosService = inject(ComunicadosService);
  private readonly contentRefresh = inject(ContentRefreshService);

  readonly noticias = signal<Comunicado[]>([]);
  readonly eventos = EVENTOS;

  constructor() {
    this.contentRefresh.comunicadosChanged$
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.carregar());
  }

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.comunicadosService.listar().subscribe({
      next: (list) => this.noticias.set(list),
      error: () => this.noticias.set([]),
    });
  }
}
