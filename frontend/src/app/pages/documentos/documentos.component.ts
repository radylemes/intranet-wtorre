import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TopbarComponent } from '../../shared/topbar/topbar.component';
import { HeaderComponent } from '../../shared/header/header.component';
import { FooterComponent } from '../../shared/footer/footer.component';
import { DocumentosService } from '../../services/documentos.service';
import { AuthService } from '../../services/auth.service';
import { DocSidebarNodeComponent } from './doc-sidebar-node.component';
import {
  CategoriaDocumento,
  Documento,
  PREVIEWABLE_EXTENSIONS,
} from '../../models/documento.model';

@Component({
  selector: 'app-documentos',
  standalone: true,
  imports: [TopbarComponent, HeaderComponent, FooterComponent, FormsModule, DocSidebarNodeComponent],
  templateUrl: './documentos.component.html',
  styleUrl: './documentos.component.scss',
})
export class DocumentosComponent implements OnInit, OnDestroy {
  private readonly documentosService = inject(DocumentosService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly sanitizer = inject(DomSanitizer);

  readonly categorias = signal<CategoriaDocumento[]>([]);
  readonly documentos = signal<Documento[]>([]);
  readonly categoriaAtiva = signal<CategoriaDocumento | null>(null);
  readonly busca = signal('');
  readonly carregando = signal(false);
  readonly erro = signal('');
  readonly recolhidos = signal<Set<number>>(new Set());
  readonly modalAberto = signal(false);
  readonly modalTitulo = signal('');
  readonly modalUrl = signal<SafeResourceUrl | null>(null);
  readonly modalCarregando = signal(false);

  private blobUrlAtual: string | null = null;

  ngOnInit(): void {
    this.document.body.classList.add('pagina-inicio');
    this.auth.carregarPerfil().subscribe();
    this.carregarCategorias();
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      if (slug && this.categorias().length) {
        this.selecionarPorSlug(slug);
      }
    });
  }

  ngOnDestroy(): void {
    this.document.body.classList.remove('pagina-inicio');
    this.fecharModal();
  }

  carregarCategorias(): void {
    this.documentosService.listarCategorias().subscribe({
      next: (tree) => {
        this.categorias.set(tree);
        const slug = this.route.snapshot.paramMap.get('slug');
        if (slug) {
          this.selecionarPorSlug(slug);
        } else if (tree.length) {
          this.selecionarCategoria(this.findFirstLeafOrRoot(tree[0]));
        }
      },
      error: (err: HttpErrorResponse) =>
        this.erro.set(err.error?.mensagem || 'Erro ao carregar categorias.'),
    });
  }

  private findFirstLeafOrRoot(cat: CategoriaDocumento): CategoriaDocumento {
    if (cat.children?.length) {
      return this.findFirstLeafOrRoot(cat.children[0]);
    }
    return cat;
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

  selecionarPorSlug(slug: string): void {
    const cat = this.findBySlug(this.categorias(), slug);
    if (cat) {
      this.selecionarCategoria(cat, false);
    } else {
      this.erro.set('Categoria não encontrada.');
    }
  }

  selecionarCategoria(cat: CategoriaDocumento, navegar = true): void {
    this.categoriaAtiva.set(cat);
    this.busca.set('');
    this.carregarDocumentos(cat);
    if (navegar) {
      this.router.navigate(['/documentos', cat.slug]);
    }
  }

  carregarDocumentos(cat: CategoriaDocumento): void {
    this.carregando.set(true);
    this.erro.set('');
    this.documentosService.listarDocumentos(cat.slug).subscribe({
      next: (docs) => {
        this.documentos.set(docs);
        this.carregando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.erro.set(err.error?.mensagem || 'Erro ao carregar documentos.');
        this.carregando.set(false);
      },
    });
  }

  documentosFiltrados(): Documento[] {
    const q = this.busca().trim().toLowerCase();
    if (!q) return this.documentos();
    return this.documentos().filter(
      (d) =>
        d.titulo.toLowerCase().includes(q) ||
        (d.descricao || '').toLowerCase().includes(q) ||
        d.nome_original.toLowerCase().includes(q)
    );
  }

  toggleRecolher(id: number): void {
    this.recolhidos.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  isRecolhido(id: number): boolean {
    return this.recolhidos().has(id);
  }

  iconeExtensao(ext: string): string {
    const map: Record<string, string> = {
      pdf: 'pdf',
      docx: 'doc',
      xlsx: 'xls',
      pptx: 'ppt',
      png: 'img',
      jpg: 'img',
      jpeg: 'img',
      zip: 'zip',
    };
    return map[ext] || 'file';
  }

  iconeCategoria(icone: string | null | undefined): string {
    return icone || 'folder';
  }

  formatarTamanho(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  formatarData(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
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
