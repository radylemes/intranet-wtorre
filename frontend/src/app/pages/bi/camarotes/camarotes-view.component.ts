import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { PublicChromeComponent } from '../../../shared/public-chrome/public-chrome.component';
import { FooterComponent } from '../../../shared/footer/footer.component';
import { CamarotesDashboardComponent } from '../../../shared/camarotes/camarotes-dashboard.component';
import { CamarotesService } from '../../../services/camarotes.service';
import { CamarotesDashboard } from '../../../models/camarote.model';

@Component({
  selector: 'app-camarotes-view',
  standalone: true,
  imports: [PublicChromeComponent, FooterComponent, CamarotesDashboardComponent],
  templateUrl: './camarotes-view.component.html',
  styleUrl: './camarotes-view.component.scss',
})
export class CamarotesViewComponent implements OnInit, OnDestroy {
  private readonly camarotesService = inject(CamarotesService);
  private readonly document = inject(DOCUMENT);

  readonly dashboard = signal<CamarotesDashboard | null>(null);
  readonly carregando = signal(false);
  readonly erro = signal('');

  readonly ultimaSyncLabel = computed(() => {
    const d = this.dashboard()?.ultima_sync;
    return d ? new Date(d).toLocaleString('pt-BR') : 'Nunca sincronizado';
  });

  ngOnInit(): void {
    this.document.body.classList.add('pagina-camarotes');
    this.carregar();
  }

  ngOnDestroy(): void {
    this.document.body.classList.remove('pagina-camarotes');
  }

  carregar(): void {
    this.carregando.set(true);
    this.erro.set('');
    this.camarotesService.dashboard().subscribe({
      next: (d) => {
        this.dashboard.set(d);
        this.carregando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.erro.set(err.error?.mensagem || 'Erro ao carregar dashboard.');
        this.carregando.set(false);
      },
    });
  }
}
