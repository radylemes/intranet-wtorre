import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { PublicChromeComponent } from '../../shared/public-chrome/public-chrome.component';
import { FooterComponent } from '../../shared/footer/footer.component';
import { DocumentosService } from '../../services/documentos.service';
import { AuthService } from '../../services/auth.service';
import { DocumentoListComponent } from './documento-list.component';
import { DocumentoPreviewModalComponent } from './documento-preview-modal.component';
import {
  CategoriaDocumento,
  Documento,
  PREVIEWABLE_EXTENSIONS,
} from '../../models/documento.model';
import { filtrarDocumentos } from './documento.util';

interface SecaoDocumentos {
  categoria: CategoriaDocumento;
  documentos: Documento[];
}

@Component({
  selector: 'app-documento-categoria',
  standalone: true,
  imports: [
    PublicChromeComponent,
    FooterComponent,
    FormsModule,
    RouterLink,
    DocumentoListComponent,
    DocumentoPreviewModalComponent,
  ],
  templateUrl: './documento-categoria.component.html',
  styleUrl: './documento-categoria.component.scss',
})
export class DocumentoCategoriaComponent implements OnInit, OnDestroy {
  private readonly documentosService = inject(DocumentosService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly sanitizer = inject(DomSanitizer);

  readonly categoria = signal<CategoriaDocumento | null>(null);
  readonly docsRaiz = signal<Documento[]>([]);
  readonly secoes = signal<SecaoDocumentos[]>([]);
  readonly busca = signal('');
  readonly carregando = signal(true);
  readonly erro = signal('');
  readonly modalAberto = signal(false);
  readonly modalTitulo = signal('');
  readonly modalUrl = signal<SafeResourceUrl | null>(null);
  readonly modalCarregando = signal(false);

  readonly docsRaizFiltrados = computed(() => filtrarDocumentos(this.docsRaiz(), this.busca()));

  readonly secoesFiltradas = computed(() => {
    const q = this.busca().trim().toLowerCase();
    return this.secoes()
      .map((secao) => ({
        ...secao,
        documentos: filtrarDocumentos(secao.documentos, q),
      }))
      .filter((secao) => secao.documentos.length > 0);
  });

  readonly temResultados = computed(() => {
    if (this.carregando()) return false;
    return this.docsRaizFiltrados().length > 0 || this.secoesFiltradas().length > 0;
  });

  private blobUrlAtual: string | null = null;

  ngOnInit(): void {
    this.document.body.classList.add('pagina-inicio');
    this.auth.carregarPerfil().subscribe();
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      if (slug) {
        this.resolverCategoria(slug);
      }
    });
  }

  ngOnDestroy(): void {
    this.document.body.classList.remove('pagina-inicio');
    this.fecharModal();
  }

  private resolverCategoria(slug: string): void {
    this.carregando.set(true);
    this.erro.set('');
    this.documentosService.listarCategorias().subscribe({
      next: (tree) => {
        const found = this.findBySlug(tree, slug);
        if (!found) {
          this.erro.set('Categoria não encontrada.');
          this.carregando.set(false);
          return;
        }

        const raiz = this.findRoot(tree, found);
        if (raiz.slug !== slug) {
          this.router.navigate(['/documentos', raiz.slug], { replaceUrl: true });
          return;
        }

        this.categoria.set(raiz);
        this.carregarDocumentos(raiz);
      },
      error: (err: HttpErrorResponse) => {
        this.erro.set(err.error?.mensagem || 'Erro ao carregar categorias.');
        this.carregando.set(false);
      },
    });
  }

  private findBySlug(items: CategoriaDocumento[], slug: string): CategoriaDocumento | null {
    for (const item of items) {
      if (item.slug === slug) return item;
      if (item.children?.length) {
        const found = this.findBySlug(item.children, slug);
        if (found) return found;
      }
    }
    return null;
  }

  private findRoot(tree: CategoriaDocumento[], cat: CategoriaDocumento): CategoriaDocumento {
    const flat = this.flattenWithParent(tree);
    let current: CategoriaDocumento | undefined = cat;
    while (current) {
      const entry = flat.find((e) => e.cat.id === current!.id);
      if (!entry?.parent) return current;
      current = entry.parent;
    }
    return cat;
  }

  private flattenWithParent(
    items: CategoriaDocumento[],
    parent: CategoriaDocumento | null = null
  ): { cat: CategoriaDocumento; parent: CategoriaDocumento | null }[] {
    const result: { cat: CategoriaDocumento; parent: CategoriaDocumento | null }[] = [];
    for (const item of items) {
      result.push({ cat: item, parent });
      if (item.children?.length) {
        result.push(...this.flattenWithParent(item.children, item));
      }
    }
    return result;
  }

  private carregarDocumentos(raiz: CategoriaDocumento): void {
    const filhos = raiz.children ?? [];
    const requests = [
      this.documentosService.listarDocumentos(raiz.slug),
      ...filhos.map((filho) => this.documentosService.listarDocumentos(filho.slug)),
    ];

    forkJoin(requests).subscribe({
      next: (results) => {
        this.docsRaiz.set(results[0] ?? []);
        this.secoes.set(
          filhos.map((filho, i) => ({
            categoria: filho,
            documentos: results[i + 1] ?? [],
          }))
        );
        this.carregando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.erro.set(err.error?.mensagem || 'Erro ao carregar documentos.');
        this.carregando.set(false);
      },
    });
  }

  visualizar(doc: Documento): void {
    if (!PREVIEWABLE_EXTENSIONS.includes(doc.extensao)) {
      this.baixar(doc);
      return;
    }
    this.modalAberto.set(true);
    this.modalTitulo.set(doc.titulo);
    this.modalCarregando.set(true);
    this.documentosService.visualizar(doc.id).subscribe({
      next: (blob) => {
        this.revogarBlob();
        this.blobUrlAtual = URL.createObjectURL(blob);
        this.modalUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.blobUrlAtual));
        this.modalCarregando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.erro.set(err.error?.mensagem || 'Erro ao visualizar documento.');
        this.fecharModal();
      },
    });
  }

  baixar(doc: Documento): void {
    this.documentosService.baixar(doc.id).subscribe({
      next: (blob) => this.documentosService.downloadBlob(blob, doc.nome_original),
      error: (err: HttpErrorResponse) =>
        this.erro.set(err.error?.mensagem || 'Erro ao baixar documento.'),
    });
  }

  fecharModal(): void {
    this.modalAberto.set(false);
    this.modalUrl.set(null);
    this.modalTitulo.set('');
    this.revogarBlob();
  }

  private revogarBlob(): void {
    if (this.blobUrlAtual) {
      URL.revokeObjectURL(this.blobUrlAtual);
      this.blobUrlAtual = null;
    }
  }
}
