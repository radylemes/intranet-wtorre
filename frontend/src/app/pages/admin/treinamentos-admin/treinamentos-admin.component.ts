import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { AdminModalComponent } from '../../../shared/admin/admin-modal/admin-modal.component';
import { AdminToastService } from '../../../shared/admin/admin-toast/admin-toast.service';
import { TreinamentosService } from '../../../services/treinamentos.service';
import { ContainersService } from '../../../services/containers.service';
import { TreinamentoAdmin } from '../../../models/treinamento.model';
import { StorageContainer } from '../../../models/storage-container.model';
import {
  CATEGORIAS_LISTA,
  formatarDuracao,
  parseDuracaoInput,
} from '../../../utils/treinamento-categoria.util';

@Component({
  selector: 'app-treinamentos-admin',
  standalone: true,
  imports: [ReactiveFormsModule, AdminModalComponent],
  templateUrl: './treinamentos-admin.component.html',
  styleUrl: './treinamentos-admin.component.scss',
})
export class TreinamentosAdminComponent implements OnInit {
  private readonly treinamentosService = inject(TreinamentosService);
  private readonly containersService = inject(ContainersService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(AdminToastService);

  readonly categorias = CATEGORIAS_LISTA;
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
    categoria: ['onboarding', Validators.required],
    area: [''],
    duracao: [''],
    destaque: [false],
    container: [''],
    ativo: [true],
  });

  constructor() {
    effect(() => {
      const msg = this.mensagem();
      if (msg) this.toast.success(msg);
    });
    effect(() => {
      const err = this.erro();
      if (err) this.toast.error(err);
    });
  }

  ngOnInit(): void {
    this.carregar();
    this.carregarContainers();
  }

  carregar(): void {
    this.treinamentosService.listarAdmin().subscribe({
      next: (list) => this.treinamentos.set(list),
      error: (err: HttpErrorResponse) =>
        this.erro.set(err.error?.mensagem || 'Erro ao carregar treinamentos.'),
    });
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

  novo(): void {
    this.cancelar();
    const padrao = this.containers().find((c) => c.padrao);
    this.form.patchValue({ container: padrao?.nome ?? '' });
    this.modalAberto.set(true);
  }

  editar(t: TreinamentoAdmin): void {
    this.editandoId.set(t.id);
    this.form.patchValue({
      titulo: t.titulo,
      descricao: t.descricao ?? '',
      categoria: t.categoria,
      area: t.area ?? '',
      duracao: formatarDuracao(t.duracaoSeg),
      destaque: t.destaque,
      container: t.container,
      ativo: t.ativo,
    });
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
    this.form.reset({
      categoria: 'onboarding',
      destaque: false,
      ativo: true,
      container: this.containers().find((c) => c.padrao)?.nome ?? '',
    });
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
    formData.append('categoria', raw.categoria);
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

  excluir(t: TreinamentoAdmin): void {
    if (!confirm(`Remover o treinamento "${t.titulo}"? O vídeo será apagado do storage.`)) return;
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
}
