import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { DocumentosService } from '../../../services/documentos.service';
import {
  ALLOWED_EXTENSIONS,
  CATEGORIA_ICONES,
  CategoriaDocumento,
  Documento,
  MAX_UPLOAD_MB,
} from '../../../models/documento.model';
import { DocAdminNodeAction, DocAdminNodeComponent } from './doc-admin-node.component';
import { AdminDrawerComponent } from '../../../shared/admin/admin-drawer/admin-drawer.component';
import { AdminModalComponent } from '../../../shared/admin/admin-modal/admin-modal.component';
import { AdminDropzoneComponent } from '../../../shared/admin/admin-dropzone/admin-dropzone.component';
import { AlertasService } from '../../../services/alertas.service';

interface PaiOption {
  id: number;
  label: string;
  depth: number;
}

@Component({
  selector: 'app-documentos-admin',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DocAdminNodeComponent,
    AdminDrawerComponent,
    AdminModalComponent,
    AdminDropzoneComponent,
  ],
  templateUrl: './documentos-admin.component.html',
  styleUrl: './documentos-admin.component.scss',
})
export class DocumentosAdminComponent implements OnInit {
  readonly MAX_UPLOAD_MB = MAX_UPLOAD_MB;
  readonly iconesCategoria = CATEGORIA_ICONES;
  private readonly documentosService = inject(DocumentosService);
  private readonly fb = inject(FormBuilder);
  private readonly alertas = inject(AlertasService);

  readonly categorias = signal<CategoriaDocumento[]>([]);
  readonly documentos = signal<Documento[]>([]);
  readonly categoriaSelecionada = signal<CategoriaDocumento | null>(null);
  readonly mensagem = signal('');
  readonly erro = signal('');
  readonly salvando = signal(false);
  readonly editandoCatId = signal<number | null>(null);
  readonly editandoDocId = signal<number | null>(null);
  readonly uploadProgress = signal(0);
  readonly uploadando = signal(false);
  readonly modalCatAberto = signal(false);
  readonly drawerDocAberto = signal(false);

  readonly catForm = this.fb.nonNullable.group({
    nome: ['', Validators.required],
    descricao: [''],
    icone: ['folder'],
    parent_id: ['' as string | number],
    ordem: [0],
    ativo: [true],
  });

  readonly docForm = this.fb.nonNullable.group({
    titulo: ['', Validators.required],
    descricao: [''],
    categoria_id: ['' as string | number, Validators.required],
  });

  selectedFile: File | null = null;

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
    this.carregarCategorias();
  }

  carregarCategorias(): void {
    this.documentosService.listarCategoriasAdmin().subscribe({
      next: (tree) => this.categorias.set(tree),
      error: (err: HttpErrorResponse) =>
        this.erro.set(err.error?.mensagem || 'Erro ao carregar categorias.'),
    });
  }

  carregarDocumentos(cat: CategoriaDocumento): void {
    this.categoriaSelecionada.set(cat);
    this.docForm.patchValue({ categoria_id: cat.id });
    this.documentosService.listarDocumentos(cat.slug).subscribe({
      next: (docs) => this.documentos.set(docs),
      error: (err: HttpErrorResponse) =>
        this.erro.set(err.error?.mensagem || 'Erro ao carregar documentos.'),
    });
  }

  paisDisponiveis(): PaiOption[] {
    const editId = this.editandoCatId();
    const exclude = new Set<number>();
    if (editId != null) {
      exclude.add(editId);
      this.collectDescendants(editId, this.categorias(), exclude);
    }
    return this.flattenTreeOptions(this.categorias()).filter((n) => !exclude.has(n.id));
  }

  onNodeAction(event: DocAdminNodeAction): void {
    switch (event.type) {
      case 'select':
        this.carregarDocumentos(event.item);
        break;
      case 'edit':
        this.editarCategoria(event.item);
        break;
      case 'remove':
        this.excluirCategoria(event.item);
        break;
    }
  }

  novaCategoria(): void {
    this.cancelarCategoria();
    this.modalCatAberto.set(true);
  }

  editarCategoria(item: CategoriaDocumento): void {
    this.editandoCatId.set(item.id);
    this.catForm.patchValue({
      nome: item.nome,
      descricao: item.descricao || '',
      icone: this.normalizarIcone(item.icone),
      parent_id: item.parent_id ?? '',
      ordem: item.ordem ?? 0,
      ativo: item.ativo !== false,
    });
    this.modalCatAberto.set(true);
  }

  fecharModalCat(): void {
    this.modalCatAberto.set(false);
    this.cancelarCategoria();
  }

  cancelarCategoria(): void {
    this.editandoCatId.set(null);
    this.catForm.reset({
      nome: '',
      descricao: '',
      icone: 'folder',
      parent_id: '',
      ordem: 0,
      ativo: true,
    });
  }

  normalizarIcone(icone: string | null | undefined): string {
    const val = icone?.trim().toLowerCase() || 'folder';
    return CATEGORIA_ICONES.some((i) => i.value === val) ? val : 'folder';
  }

  selecionarIcone(value: string): void {
    this.catForm.patchValue({ icone: value });
  }

  iconeSelecionado(): string {
    return this.catForm.controls.icone.value;
  }

  tituloModalCat(): string {
    return this.editandoCatId() ? 'Editar categoria' : 'Nova categoria';
  }

  salvarCategoria(): void {
    if (this.catForm.invalid) return;
    this.salvando.set(true);
    this.erro.set('');
    this.mensagem.set('');
    const raw = this.catForm.getRawValue();
    const payload = {
      nome: raw.nome,
      descricao: raw.descricao || null,
      icone: raw.icone || null,
      parent_id: raw.parent_id === '' ? null : Number(raw.parent_id),
      ordem: Number(raw.ordem),
      ativo: raw.ativo,
    };
    const editId = this.editandoCatId();
    const req = editId
      ? this.documentosService.atualizarCategoria(editId, payload)
      : this.documentosService.criarCategoria(payload);

    req.subscribe({
      next: (saved) => {
        const isRaiz = payload.parent_id == null;
        if (!editId && isRaiz && saved?.slug) {
          this.mensagem.set(`Categoria criada. Página disponível em /documentos/${saved.slug}`);
        } else if (editId && isRaiz && saved?.slug) {
          this.mensagem.set(`Categoria atualizada. Página em /documentos/${saved.slug}`);
        } else if (!editId && !isRaiz) {
          this.mensagem.set('Subcategoria criada. Ela aparece na página da categoria pai.');
        } else {
          this.mensagem.set(editId ? 'Categoria atualizada.' : 'Categoria criada.');
        }
        this.salvando.set(false);
        this.modalCatAberto.set(false);
        this.cancelarCategoria();
        this.carregarCategorias();
      },
      error: (err: HttpErrorResponse) => {
        this.erro.set(err.error?.mensagem || 'Erro ao salvar categoria.');
        this.salvando.set(false);
      },
    });
  }

  async excluirCategoria(item: CategoriaDocumento): Promise<void> {
    const ok = await this.alertas.confirmarExclusao({
      texto: `Remover a categoria "${item.nome}" e todos os documentos/subcategorias?`,
    });
    if (!ok) return;
    this.documentosService.removerCategoria(item.id).subscribe({
      next: () => {
        this.mensagem.set('Categoria removida.');
        if (this.categoriaSelecionada()?.id === item.id) {
          this.categoriaSelecionada.set(null);
          this.documentos.set([]);
        }
        this.carregarCategorias();
      },
      error: (err: HttpErrorResponse) =>
        this.erro.set(err.error?.mensagem || 'Erro ao remover categoria.'),
    });
  }

  onFileSelected(file: File): void {
    this.selectedFile = file;
    this.erro.set('');
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      this.erro.set('Tipo de arquivo não permitido.');
      this.selectedFile = null;
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      this.erro.set(`Arquivo excede o limite de ${MAX_UPLOAD_MB} MB.`);
      this.selectedFile = null;
      return;
    }
    if (!this.docForm.controls.titulo.value) {
      const baseName = file.name.replace(/\.[^.]+$/, '');
      this.docForm.patchValue({ titulo: baseName });
    }
    this.abrirDrawerDoc(false);
  }

  abrirDrawerDoc(reset = true): void {
    if (reset && !this.editandoDocId()) {
      this.cancelarDocumento();
    }
    this.drawerDocAberto.set(true);
  }

  fecharDrawerDoc(): void {
    this.drawerDocAberto.set(false);
    this.cancelarDocumento();
  }

  editarDocumento(doc: Documento): void {
    this.editandoDocId.set(doc.id);
    this.docForm.patchValue({
      titulo: doc.titulo,
      descricao: doc.descricao || '',
      categoria_id: doc.categoria_id,
    });
    this.selectedFile = null;
    this.drawerDocAberto.set(true);
  }

  cancelarDocumento(): void {
    this.editandoDocId.set(null);
    const catId = this.categoriaSelecionada()?.id ?? '';
    this.docForm.reset({ titulo: '', descricao: '', categoria_id: catId });
    this.selectedFile = null;
    this.uploadProgress.set(0);
  }

  salvarDocumento(): void {
    if (this.docForm.invalid) return;
    const editId = this.editandoDocId();

    if (editId) {
      this.salvando.set(true);
      this.mensagem.set('');
      this.erro.set('');
      const raw = this.docForm.getRawValue();
      this.documentosService
        .atualizarDocumento(editId, {
          titulo: raw.titulo,
          descricao: raw.descricao || null,
          categoria_id: Number(raw.categoria_id),
        })
        .subscribe({
          next: () => {
            this.mensagem.set('Documento atualizado.');
            this.salvando.set(false);
            this.drawerDocAberto.set(false);
            this.cancelarDocumento();
            const cat = this.categoriaSelecionada();
            if (cat) this.carregarDocumentos(cat);
          },
          error: (err: HttpErrorResponse) => {
            this.erro.set(err.error?.mensagem || 'Erro ao atualizar documento.');
            this.salvando.set(false);
          },
        });
      return;
    }

    if (!this.selectedFile) {
      this.erro.set('Selecione um arquivo para upload.');
      return;
    }

    const raw = this.docForm.getRawValue();
    const formData = new FormData();
    formData.append('arquivo', this.selectedFile);
    formData.append('titulo', raw.titulo);
    formData.append('descricao', raw.descricao || '');
    formData.append('categoria_id', String(raw.categoria_id));

    this.uploadando.set(true);
    this.uploadProgress.set(0);
    this.erro.set('');
    this.mensagem.set('');

    this.documentosService.uploadDocumento(formData).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.uploadProgress.set(Math.round((100 * event.loaded) / event.total));
        } else if (event.type === HttpEventType.Response) {
          this.mensagem.set('Documento enviado com sucesso.');
          this.uploadando.set(false);
          this.uploadProgress.set(0);
          this.drawerDocAberto.set(false);
          this.cancelarDocumento();
          const cat = this.categoriaSelecionada();
          if (cat) this.carregarDocumentos(cat);
          this.carregarCategorias();
        }
      },
      error: (err: HttpErrorResponse) => {
        this.erro.set(err.error?.mensagem || 'Erro no upload.');
        this.uploadando.set(false);
        this.uploadProgress.set(0);
      },
    });
  }

  async excluirDocumento(doc: Documento): Promise<void> {
    const ok = await this.alertas.confirmarExclusao({
      texto: `Remover o documento "${doc.titulo}"?`,
    });
    if (!ok) return;
    this.documentosService.removerDocumento(doc.id).subscribe({
      next: () => {
        this.mensagem.set('Documento removido.');
        const cat = this.categoriaSelecionada();
        if (cat) this.carregarDocumentos(cat);
        this.carregarCategorias();
      },
      error: (err: HttpErrorResponse) =>
        this.erro.set(err.error?.mensagem || 'Erro ao remover documento.'),
    });
  }

  formatarTamanho(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  }

  formatarData(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d
      .toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
      .replace(/\./g, '')
      .replace(/ de /g, ' ');
  }

  formatarMetaDoc(doc: Documento): string {
    const partes = [
      doc.extensao.toUpperCase(),
      this.formatarTamanho(doc.tamanho_bytes),
      this.formatarData(doc.criado_em),
    ].filter(Boolean);
    return partes.join(' · ');
  }

  fileIconClass(ext: string): string {
    const e = ext.toLowerCase();
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'png', 'jpg', 'jpeg', 'zip'].includes(e)) {
      return e;
    }
    return 'default';
  }

  tituloDrawerDoc(): string {
    return this.editandoDocId() ? 'Editar documento' : 'Upload de documento';
  }

  labelSalvarDoc(): string {
    if (this.editandoDocId()) return 'Salvar alterações';
    if (this.uploadando()) return 'Enviando...';
    return 'Enviar documento';
  }

  categoriasFlatSelect(): PaiOption[] {
    return this.flattenTreeOptions(this.categorias());
  }

  private flattenTreeOptions(items: CategoriaDocumento[], depth = 0): PaiOption[] {
    const out: PaiOption[] = [];
    for (const item of items) {
      out.push({ id: item.id, label: item.nome, depth });
      if (item.children?.length) {
        out.push(...this.flattenTreeOptions(item.children, depth + 1));
      }
    }
    return out;
  }

  private collectDescendants(id: number, items: CategoriaDocumento[], exclude: Set<number>): void {
    for (const item of items) {
      if (item.parent_id === id) {
        exclude.add(item.id);
        this.collectDescendants(item.id, items, exclude);
      }
      if (item.children?.length) {
        this.collectDescendants(id, item.children, exclude);
      }
    }
  }
}
