import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';
import {
  CategoriaDocumento,
  DocumentoPagina,
  VisibilidadeEntidade,
  VisibilidadeEntidadeInput,
} from '../../../models/documento.model';
import { DocumentosService } from '../../../services/documentos.service';

interface EntidadeRow {
  pagina: DocumentoPagina;
  ativo: boolean;
  categoriaId: number | null;
  categorias: CategoriaDocumento[];
  flat: { id: number; label: string; depth: number }[];
}

@Component({
  selector: 'app-conteudo-entidades-editor',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './conteudo-entidades-editor.component.html',
  styleUrl: './conteudo-entidades-editor.component.scss',
})
export class ConteudoEntidadesEditorComponent {
  private readonly documentosService = inject(DocumentosService);

  readonly paginas = input<DocumentoPagina[]>([]);
  readonly value = input<VisibilidadeEntidade[]>([]);
  readonly variant = input<'default' | 'vrow'>('default');

  readonly valueChange = output<VisibilidadeEntidadeInput[]>();

  readonly rows = signal<EntidadeRow[]>([]);
  readonly carregando = signal(true);
  readonly erro = signal('');
  readonly paginasInternas = signal<DocumentoPagina[]>([]);

  private initSeq = 0;
  private treesByPagina = new Map<number, CategoriaDocumento[]>();

  constructor() {
    this.documentosService.listarPaginasAdmin().subscribe({
      next: (items) => this.paginasInternas.set(items.filter((p) => p.ativo !== false)),
      error: () => {},
    });

    effect(() => {
      const paginasIn = this.paginas();
      const paginas =
        paginasIn.length > 0
          ? paginasIn.filter((p) => p.ativo !== false)
          : this.paginasInternas();
      const value = this.value();

      if (!paginas.length) {
        this.rows.set([]);
        this.carregando.set(true);
        this.erro.set('');
        return;
      }

      const faltamArvores = paginas.some((p) => !this.treesByPagina.has(p.id));
      if (faltamArvores) {
        this.carregarRows(paginas, value);
        return;
      }

      this.rows.set(this.buildRows(paginas, value));
      this.carregando.set(false);
      this.emitir();
    });
  }

  private carregarRows(paginas: DocumentoPagina[], value: VisibilidadeEntidade[]): void {
    const seq = ++this.initSeq;
    if (!paginas.length) {
      return;
    }

    this.carregando.set(true);
    this.erro.set('');

    const reqs = paginas.map((p) =>
      this.documentosService.listarCategoriasAdmin(p.id).pipe(catchError(() => of([] as CategoriaDocumento[])))
    );

    forkJoin(reqs).subscribe({
      next: (trees) => {
        if (seq !== this.initSeq) return;
        paginas.forEach((pagina, i) => {
          this.treesByPagina.set(pagina.id, trees[i] ?? []);
        });
        this.rows.set(this.buildRows(paginas, value));
        this.carregando.set(false);
        this.emitir();
      },
      error: () => {
        if (seq !== this.initSeq) return;
        this.carregando.set(false);
        this.erro.set('Não foi possível carregar as categorias das entidades.');
      },
    });
  }

  private buildRows(paginas: DocumentoPagina[], value: VisibilidadeEntidade[]): EntidadeRow[] {
    const visMap = new Map(value.map((v) => [Number(v.pagina_id), v]));
    return paginas.map((pagina) => {
      const vis = visMap.get(Number(pagina.id));
      const tree = this.treesByPagina.get(pagina.id) ?? [];
      const flat = this.flattenCategorias(tree);
      const ativo = !!vis;
      let categoriaId = vis?.categoria_id != null ? Number(vis.categoria_id) : null;
      if (ativo && categoriaId == null && flat.length) {
        categoriaId = flat[0].id;
      }
      if (ativo && categoriaId != null && flat.length && !flat.some((c) => c.id === categoriaId)) {
        categoriaId = flat[0].id;
      }
      return {
        pagina,
        ativo,
        categoriaId,
        categorias: tree,
        flat,
      };
    });
  }

  private flattenCategorias(
    nodes: CategoriaDocumento[],
    depth = 0,
    acc: { id: number; label: string; depth: number }[] = []
  ): { id: number; label: string; depth: number }[] {
    for (const node of nodes) {
      acc.push({ id: node.id, label: node.nome, depth });
      if (node.children?.length) {
        this.flattenCategorias(node.children, depth + 1, acc);
      }
    }
    return acc;
  }

  toggleEntidade(row: EntidadeRow, ativo: boolean): void {
    row.ativo = ativo;
    if (!ativo) {
      row.categoriaId = null;
    } else if (!row.categoriaId && row.flat.length) {
      row.categoriaId = row.flat[0].id;
    }
    this.rows.set([...this.rows()]);
    this.emitir();
  }

  alterarCategoria(row: EntidadeRow, raw: number | string | null): void {
    const id = raw == null || raw === '' ? null : Number(raw);
    row.categoriaId = id != null && id > 0 ? id : null;
    this.rows.set([...this.rows()]);
    this.emitir();
  }

  private emitir(): void {
    const lista: VisibilidadeEntidadeInput[] = this.rows()
      .filter((r) => r.ativo && r.categoriaId != null)
      .map((r) => ({ pagina_id: r.pagina.id, categoria_id: r.categoriaId! }));
    this.valueChange.emit(lista);
  }

  indentLabel(depth: number, label: string): string {
    return `${'— '.repeat(depth)}${label}`;
  }

  temAlgumaAtiva(): boolean {
    return this.rows().some((r) => r.ativo && r.categoriaId != null);
  }

  countAtivas(): number {
    return this.rows().filter((r) => r.ativo).length;
  }

  totalEntidades(): number {
    return this.rows().length;
  }

  nomeCategoria(row: EntidadeRow): string | null {
    if (!row.categoriaId) return null;
    return row.flat.find((c) => c.id === row.categoriaId)?.label ?? null;
  }

  corEntidade(slug: string): { accent: string; ring: string } {
    const s = slug.toLowerCase();
    if (s.includes('nubank')) return { accent: '#8d0de3', ring: 'rgba(141, 13, 227, 0.12)' };
    if (s.includes('base') || s.includes('cowork')) return { accent: '#0d9488', ring: 'rgba(13, 148, 136, 0.12)' };
    if (s.includes('novo') || s.includes('anh')) return { accent: '#c2410c', ring: 'rgba(194, 65, 12, 0.12)' };
    return { accent: '#1d54e6', ring: 'rgba(29, 84, 230, 0.12)' };
  }
}
