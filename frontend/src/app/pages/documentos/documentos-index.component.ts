import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DOCUMENT } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PublicChromeComponent } from '../../shared/public-chrome/public-chrome.component';
import { FooterComponent } from '../../shared/footer/footer.component';
import { DocumentosService } from '../../services/documentos.service';
import { ContentRefreshService } from '../../services/content-refresh.service';
import { AuthService } from '../../services/auth.service';
import { CategoriaDocumento } from '../../models/documento.model';

@Component({
  selector: 'app-documentos-index',
  standalone: true,
  imports: [PublicChromeComponent, FooterComponent, RouterLink],
  templateUrl: './documentos-index.component.html',
  styleUrl: './documentos-index.component.scss',
})
export class DocumentosIndexComponent implements OnInit, OnDestroy {
  private readonly documentosService = inject(DocumentosService);
  private readonly auth = inject(AuthService);
  private readonly document = inject(DOCUMENT);
  private readonly contentRefresh = inject(ContentRefreshService);

  readonly categorias = signal<CategoriaDocumento[]>([]);
  readonly carregando = signal(true);
  readonly erro = signal('');

  constructor() {
    this.contentRefresh.documentosChanged$
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.carregarCategorias(false));
  }

  ngOnInit(): void {
    this.document.body.classList.add('pagina-inicio');
    this.auth.carregarPerfil().subscribe();
    this.carregarCategorias();
  }

  ngOnDestroy(): void {
    this.document.body.classList.remove('pagina-inicio');
  }

  carregarCategorias(mostrarCarregando = true): void {
    if (mostrarCarregando || this.categorias().length === 0) {
      this.carregando.set(true);
    }
    this.erro.set('');
    this.documentosService.listarCategorias().subscribe({
      next: (tree) => {
        this.categorias.set(tree);
        this.carregando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.erro.set(err.error?.mensagem || 'Erro ao carregar categorias.');
        this.carregando.set(false);
      },
    });
  }

  iconeCategoria(icone: string | null | undefined): string {
    return icone || 'folder';
  }
}
