import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminModalComponent } from '../../../shared/admin/admin-modal/admin-modal.component';
import { AlertasService } from '../../../services/alertas.service';
import { ComunicadosService } from '../../../services/comunicados.service';
import { ComunicadoAdmin, ComunicadoCategoria } from '../../../models/comunicado.model';
import {
  COMUNICADO_CATEGORIAS,
  formatarDataExibicao,
  labelCategoria,
} from '../../../utils/comunicado-categoria.util';

@Component({
  selector: 'app-comunicados-admin',
  standalone: true,
  imports: [ReactiveFormsModule, AdminModalComponent],
  templateUrl: './comunicados-admin.component.html',
  styleUrl: './comunicados-admin.component.scss',
})
export class ComunicadosAdminComponent implements OnInit {
  private readonly comunicadosService = inject(ComunicadosService);
  private readonly fb = inject(FormBuilder);
  private readonly alertas = inject(AlertasService);

  readonly categorias = COMUNICADO_CATEGORIAS;
  readonly comunicados = signal<ComunicadoAdmin[]>([]);
  readonly busca = signal('');
  readonly carregando = signal(true);
  readonly mensagem = signal('');
  readonly erro = signal('');
  readonly salvando = signal(false);
  readonly editandoId = signal<number | null>(null);
  readonly modalAberto = signal(false);

  readonly comunicadosFiltrados = computed(() => {
    const q = this.busca().trim().toLowerCase();
    const list = this.comunicados();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.titulo.toLowerCase().includes(q) ||
        c.categoriaLabel.toLowerCase().includes(q) ||
        labelCategoria(c.categoria).toLowerCase().includes(q)
    );
  });

  private buscaTimer: ReturnType<typeof setTimeout> | null = null;

  readonly form = this.fb.nonNullable.group({
    titulo: ['', Validators.required],
    categoria: ['rh' as ComunicadoCategoria, Validators.required],
    dataPublicacao: ['', Validators.required],
    ordem: ['' as string | number],
    ativo: [true],
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
    this.carregar();
  }

  onBuscaInput(value: string): void {
    if (this.buscaTimer) clearTimeout(this.buscaTimer);
    this.buscaTimer = setTimeout(() => this.busca.set(value), 300);
  }

  carregar(): void {
    this.carregando.set(true);
    this.comunicadosService.listarAdmin().subscribe({
      next: (list) => {
        this.comunicados.set(list);
        this.carregando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.erro.set(err.error?.mensagem || 'Erro ao carregar comunicados.');
        this.carregando.set(false);
      },
    });
  }

  novo(): void {
    this.cancelar();
    this.form.patchValue({
      categoria: 'rh',
      dataPublicacao: new Date().toISOString().slice(0, 10),
      ativo: true,
    });
    this.modalAberto.set(true);
  }

  editar(c: ComunicadoAdmin): void {
    this.editandoId.set(c.id);
    this.form.patchValue({
      titulo: c.titulo,
      categoria: c.categoria,
      dataPublicacao: c.dataPublicacao,
      ordem: c.ordem ?? '',
      ativo: c.ativo,
    });
    this.modalAberto.set(true);
  }

  fecharModal(): void {
    this.modalAberto.set(false);
    this.cancelar();
  }

  cancelar(): void {
    this.editandoId.set(null);
    this.form.reset({
      categoria: 'rh',
      ativo: true,
    });
  }

  tituloModal(): string {
    return this.editandoId() ? 'Editar comunicado' : 'Novo comunicado';
  }

  subtituloModal(): string {
    return this.editandoId()
      ? 'Atualize o aviso exibido no mural da intranet.'
      : 'Cadastre um aviso para o mural da página inicial.';
  }

  salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const ordemRaw = raw.ordem;
    const ordem =
      ordemRaw === '' || ordemRaw === null || ordemRaw === undefined
        ? null
        : Number(ordemRaw);

    if (ordem != null && !Number.isFinite(ordem)) {
      this.erro.set('Ordem deve ser um número.');
      return;
    }

    const payload = {
      titulo: raw.titulo.trim(),
      categoria: raw.categoria,
      dataPublicacao: raw.dataPublicacao,
      ordem,
      ativo: raw.ativo,
    };

    const editId = this.editandoId();
    this.salvando.set(true);
    this.erro.set('');
    this.mensagem.set('');

    const req = editId
      ? this.comunicadosService.atualizar(editId, payload)
      : this.comunicadosService.criar(payload);

    req.subscribe({
      next: () => {
        this.mensagem.set(editId ? 'Comunicado atualizado.' : 'Comunicado criado.');
        this.salvando.set(false);
        this.modalAberto.set(false);
        this.cancelar();
        this.carregar();
      },
      error: (err: HttpErrorResponse) => {
        this.erro.set(err.error?.mensagem || 'Erro ao salvar comunicado.');
        this.salvando.set(false);
      },
    });
  }

  async excluir(c: ComunicadoAdmin): Promise<void> {
    const ok = await this.alertas.confirmarExclusao({
      titulo: `Excluir “${c.titulo}”?`,
      texto: 'Esta ação não pode ser desfeita.',
    });
    if (!ok) return;

    this.comunicadosService.remover(c.id).subscribe({
      next: () => {
        this.mensagem.set('Comunicado excluído.');
        this.carregar();
      },
      error: (err: HttpErrorResponse) =>
        this.alertas.erro(err.error?.mensagem || 'Não foi possível excluir o comunicado.'),
    });
  }

  dataLabel(c: ComunicadoAdmin): string {
    return formatarDataExibicao(c.dataPublicacao);
  }

  categoriaLabel(c: ComunicadoAdmin): string {
    return c.categoriaLabel || labelCategoria(c.categoria);
  }
}
