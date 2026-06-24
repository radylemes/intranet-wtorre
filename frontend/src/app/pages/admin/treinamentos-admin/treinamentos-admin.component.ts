import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { AdminModalComponent } from '../../../shared/admin/admin-modal/admin-modal.component';
import { AlertasService } from '../../../services/alertas.service';
import { TreinamentosService } from '../../../services/treinamentos.service';
import { ContainersService } from '../../../services/containers.service';
import { DocumentosService } from '../../../services/documentos.service';
import { TreinamentoAdmin } from '../../../models/treinamento.model';
import { StorageContainer } from '../../../models/storage-container.model';
import { CategoriaDocumento, DocumentoPagina } from '../../../models/documento.model';
import { formatarDuracao, parseDuracaoInput } from '../../../utils/treinamento-categoria.util';
import {
  DocAdminNodeAction,
  DocAdminNodeComponent,
} from '../documentos/doc-admin-node.component';
import { DocCatIconeComponent } from '../../../shared/documentos/doc-cat-icone.component';

@Component({
  selector: 'app-treinamentos-admin',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AdminModalComponent,
    DocAdminNodeComponent,
    DocCatIconeComponent,
  ],
  templateUrl: './treinamentos-admin.component.html',
  styleUrl: './treinamentos-admin.component.scss',
})
export class TreinamentosAdminComponent implements OnInit {
  private readonly treinamentosService = inject(TreinamentosService);
  private readonly containersService = inject(ContainersService);
  private readonly documentosService = inject(DocumentosService);
  private readonly fb = inject(FormBuilder);
  private readonly alertas = inject(AlertasService);

  readonly paginas = signal<DocumentoPagina[]>([]);
  readonly categoriasTree = signal<CategoriaDocumento[]>([]);
  readonly categoriaSelecionadaId = signal<number | null>(null);
  readonly categoriaSelecionadaNome = signal<string | null>(null);
  readonly filtroPaginaId = signal<number | null>(null);

  readonly treinamentos = signal<TreinamentoAdmin[]>([]);
  readonly containers = signal<StorageContainer[]>([]);
  readonly mensagem = signal('');
  readonly erro = signal('');
  readonly salvando = signal(false);
  readonly uploadProgress = signal(0);
  readonly editandoId = signal<number | null>(null);
  readonly modalAberto = signal(false);

  private videoFile: File | null = null;
  private thumbFile: File | null = null;

  readonly form = this.fb.nonNullable.group({
    titulo: ['', Validators.required],
    descricao: [''],
    pagina_id: [0, Validators.required],
    area: [''],
    duracao: [''],
    destaque: [false],
    container: [''],
    ativo: [true],
  });

  readonly treinamentosFiltrados = computed(() => {
    const filtro = this.filtroPaginaId();
    const lista = this.treinamentos();
    if (filtro == null) return lista;
    return lista.filter((t) => t.paginaId === filtro);
  });

  constructor() {
    effect(() => {
      const msg = this.mensagem();
      if (msg) this.alertas.sucesso(msg);
    });
    effect(() => {
      const err = this.erro();
      if (err) this.alertas.erro(err);
    });
  }

  ngOnInit(): void {
    this.carregarPaginas();
    this.carregar();
    this.carregarContainers();
  }

  carregarPaginas(): void {
    this.documentosService.listarPaginasAdmin().subscribe({
      next: (list) => {
        this.paginas.set(list.filter((p) => p.ativo));
        const wtorre = list.find((p) => p.slug === 'wtorre');
        if (wtorre?.id && !this.form.controls.pagina_id.value) {
          this.form.patchValue({ pagina_id: wtorre.id });
          this.carregarCategorias(wtorre.id);
        }
      },
      error: () => {},
    });
  }

  carregarCategorias(paginaId: number): void {
    this.documentosService.listarCategoriasAdmin(paginaId).subscribe({
      next: (tree) => this.categoriasTree.set(tree),
      error: () => this.categoriasTree.set([]),
    });
  }

  carregar(): void {
    const paginaId = this.filtroPaginaId();
    this.treinamentosService.listarAdmin(paginaId ?? undefined).subscribe({
      next: (list) => this.treinamentos.set(list),
      error: (err: HttpErrorResponse) =>
        this.erro.set(err.error?.mensagem || 'Erro ao carregar treinamentos.'),
    });
  }

  onFiltroPaginaChange(raw: string): void {
    const id = raw === '' ? null : Number(raw);
    this.filtroPaginaId.set(id && Number.isFinite(id) ? id : null);
    this.carregar();
  }

  carregarContainers(): void {
    this.containersService.listar().subscribe({
      next: (list) => {
        const ativos = list.filter((c) => c.ativo && c.id != null);
        this.containers.set(ativos);
        const padrao = ativos.find((c) => c.padrao);
        if (padrao && !this.form.controls.container.value) {
          this.form.patchValue({ container: padrao.nome });
        }
      },
      error: () => {},
    });
  }

  onPaginaChange(raw: string): void {
    const paginaId = Number(raw);
    if (!Number.isFinite(paginaId) || paginaId <= 0) return;
    this.form.patchValue({ pagina_id: paginaId });
    this.categoriaSelecionadaId.set(null);
    this.categoriaSelecionadaNome.set(null);
    this.carregarCategorias(paginaId);
  }

  onCategoriaNode(action: DocAdminNodeAction): void {
    if (action.type !== 'select') return;
    this.categoriaSelecionadaId.set(action.item.id);
    this.categoriaSelecionadaNome.set(action.item.nome);
  }

  limparCategoria(): void {
    this.categoriaSelecionadaId.set(null);
    this.categoriaSelecionadaNome.set(null);
  }

  novo(): void {
    this.cancelar();
    const padrao = this.containers().find((c) => c.padrao);
    const paginaId = this.form.controls.pagina_id.value || this.paginas()[0]?.id;
    if (paginaId) {
      this.form.patchValue({ pagina_id: paginaId });
      this.carregarCategorias(paginaId);
    }
    this.form.patchValue({ container: padrao?.nome ?? '' });
    this.modalAberto.set(true);
  }

  editar(t: TreinamentoAdmin): void {
    this.editandoId.set(t.id);
    this.form.patchValue({
      titulo: t.titulo,
      descricao: t.descricao ?? '',
      pagina_id: t.paginaId,
      area: t.area ?? '',
      duracao: formatarDuracao(t.duracaoSeg),
      destaque: t.destaque,
      container: t.container,
      ativo: t.ativo,
    });
    this.categoriaSelecionadaId.set(t.categoriaId ?? null);
    this.categoriaSelecionadaNome.set(t.categoriaNome ?? null);
    this.carregarCategorias(t.paginaId);
    this.videoFile = null;
    this.thumbFile = null;
    this.modalAberto.set(true);
  }

  fecharModal(): void {
    this.modalAberto.set(false);
    this.cancelar();
  }

  cancelar(): void {
    this.editandoId.set(null);
    this.videoFile = null;
    this.thumbFile = null;
    this.uploadProgress.set(0);
    this.categoriaSelecionadaId.set(null);
    this.categoriaSelecionadaNome.set(null);
    const paginaId = this.paginas().find((p) => p.slug === 'wtorre')?.id ?? this.paginas()[0]?.id ?? 0;
    this.form.reset({
      pagina_id: paginaId,
      destaque: false,
      ativo: true,
      container: this.containers().find((c) => c.padrao)?.nome ?? '',
    });
    if (paginaId) this.carregarCategorias(paginaId);
  }

  tituloModal(): string {
    return this.editandoId() ? 'Editar treinamento' : 'Novo treinamento';
  }

  subtituloModal(): string {
    return this.editandoId()
      ? 'Atualize os dados; envie novo vídeo ou thumb apenas se quiser substituir.'
      : 'Envie um vídeo de capacitação para a biblioteca.';
  }

  onVideoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.videoFile = input.files?.[0] ?? null;
  }

  onThumbSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.thumbFile = input.files?.[0] ?? null;
  }

  salvar(): void {
    if (this.form.invalid) return;
    const editId = this.editandoId();
    if (!editId && !this.videoFile) {
      this.erro.set('Selecione um arquivo de vídeo.');
      return;
    }

    const raw = this.form.getRawValue();
    const formData = new FormData();
    formData.append('titulo', raw.titulo.trim());
    formData.append('descricao', raw.descricao.trim());
    formData.append('pagina_id', String(raw.pagina_id));
    const catId = this.categoriaSelecionadaId();
    if (catId != null) {
      formData.append('categoria_id', String(catId));
    } else {
      formData.append('categoria_id', '');
    }
    formData.append('area', raw.area.trim());
    const dur = parseDuracaoInput(raw.duracao);
    if (dur != null) formData.append('duracao_seg', String(dur));
    formData.append('destaque', raw.destaque ? 'true' : 'false');
    if (raw.container) formData.append('container', raw.container);
    if (editId) formData.append('ativo', raw.ativo ? 'true' : 'false');
    if (this.videoFile) formData.append('video', this.videoFile);
    if (this.thumbFile) formData.append('thumb', this.thumbFile);

    this.salvando.set(true);
    this.uploadProgress.set(0);
    this.erro.set('');
    this.mensagem.set('');

    const req = editId
      ? this.treinamentosService.atualizar(editId, formData)
      : this.treinamentosService.criar(formData);

    req.subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.uploadProgress.set(Math.round((100 * event.loaded) / event.total));
        } else if (event.type === HttpEventType.Response) {
          this.mensagem.set(editId ? 'Treinamento atualizado.' : 'Treinamento criado.');
          this.salvando.set(false);
          this.uploadProgress.set(0);
          this.modalAberto.set(false);
          this.cancelar();
          this.carregar();
        }
      },
      error: (err: HttpErrorResponse) => {
        this.erro.set(err.error?.mensagem || 'Erro ao salvar treinamento.');
        this.salvando.set(false);
        this.uploadProgress.set(0);
      },
    });
  }

  async excluir(t: TreinamentoAdmin): Promise<void> {
    const ok = await this.alertas.confirmarExclusao({
      texto: `Remover o treinamento "${t.titulo}"? O vídeo será apagado do storage.`,
    });
    if (!ok) return;
    this.treinamentosService.remover(t.id).subscribe({
      next: () => {
        this.mensagem.set('Treinamento removido.');
        this.carregar();
      },
      error: (err: HttpErrorResponse) =>
        this.erro.set(err.error?.mensagem || 'Erro ao excluir treinamento.'),
    });
  }

  duracaoLabel(t: TreinamentoAdmin): string {
    return formatarDuracao(t.duracaoSeg);
  }

  categoriaLabel(t: TreinamentoAdmin): string {
    return t.categoriaNome ?? 'Sem categoria';
  }
}
