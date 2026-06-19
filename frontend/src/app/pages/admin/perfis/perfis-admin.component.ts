import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminModalComponent } from '../../../shared/admin/admin-modal/admin-modal.component';
import { AlertasService } from '../../../services/alertas.service';
import { PerfisAcessoService } from '../../../services/perfis-acesso.service';
import { ModuloAdmin, PerfilAcesso } from '../../../models/perfil-acesso.model';

@Component({
  selector: 'app-perfis-admin',
  standalone: true,
  imports: [ReactiveFormsModule, AdminModalComponent],
  templateUrl: './perfis-admin.component.html',
  styleUrl: './perfis-admin.component.scss',
})
export class PerfisAdminComponent implements OnInit {
  private readonly api = inject(PerfisAcessoService);
  private readonly fb = inject(FormBuilder);
  private readonly alertas = inject(AlertasService);

  readonly perfis = signal<PerfilAcesso[]>([]);
  readonly modulos = signal<ModuloAdmin[]>([]);
  readonly modulosSelecionados = signal<string[]>([]);
  readonly mensagem = signal('');
  readonly erro = signal('');
  readonly salvando = signal(false);
  readonly editandoId = signal<number | null>(null);
  readonly modalAberto = signal(false);
  readonly modalModulosAberto = signal(false);
  readonly perfilModulosId = signal<number | null>(null);

  readonly form = this.fb.nonNullable.group({
    nome: ['', Validators.required],
    descricao: [''],
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
    this.api.listarModulos().subscribe({
      next: (list) => this.modulos.set(list),
      error: () => this.erro.set('Erro ao carregar módulos.'),
    });
  }

  carregar(): void {
    this.api.listarPerfis().subscribe({
      next: (list) => this.perfis.set(list),
      error: (err: HttpErrorResponse) =>
        this.erro.set(err.error?.mensagem || 'Erro ao carregar perfis.'),
    });
  }

  novoPerfil(): void {
    this.cancelar();
    this.modalAberto.set(true);
  }

  editar(p: PerfilAcesso): void {
    this.editandoId.set(p.id);
    this.form.patchValue({
      nome: p.nome,
      descricao: p.descricao ?? '',
      ativo: p.ativo,
    });
    this.modalAberto.set(true);
  }

  abrirModulos(p: PerfilAcesso): void {
    this.perfilModulosId.set(p.id);
    this.modulosSelecionados.set([...p.modulos]);
    this.modalModulosAberto.set(true);
  }

  fecharModal(): void {
    this.modalAberto.set(false);
    this.cancelar();
  }

  fecharModalModulos(): void {
    this.modalModulosAberto.set(false);
    this.perfilModulosId.set(null);
  }

  cancelar(): void {
    this.editandoId.set(null);
    this.form.reset({ ativo: true, descricao: '' });
  }

  tituloModal(): string {
    return this.editandoId() ? 'Editar perfil' : 'Novo perfil';
  }

  subtituloModal(): string {
    return 'Perfis agrupam módulos administrativos que podem ser atribuídos a usuários.';
  }

  toggleModulo(codigo: string): void {
    this.modulosSelecionados.update((list) =>
      list.includes(codigo) ? list.filter((c) => c !== codigo) : [...list, codigo]
    );
  }

  salvar(): void {
    if (this.form.invalid) return;
    this.salvando.set(true);
    this.erro.set('');
    this.mensagem.set('');

    const body = this.form.getRawValue();
    const id = this.editandoId();

    const req = id
      ? this.api.atualizarPerfil(id, body)
      : this.api.criarPerfil(body);

    req.subscribe({
      next: () => {
        this.mensagem.set(id ? 'Perfil atualizado.' : 'Perfil criado.');
        this.modalAberto.set(false);
        this.cancelar();
        this.carregar();
        this.salvando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.erro.set(err.error?.mensagem || 'Erro ao salvar.');
        this.salvando.set(false);
      },
    });
  }

  salvarModulos(): void {
    const id = this.perfilModulosId();
    if (!id) return;
    this.salvando.set(true);
    this.api.definirModulosPerfil(id, this.modulosSelecionados()).subscribe({
      next: () => {
        this.mensagem.set('Módulos do perfil atualizados.');
        this.fecharModalModulos();
        this.carregar();
        this.salvando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.erro.set(err.error?.mensagem || 'Erro ao salvar módulos.');
        this.salvando.set(false);
      },
    });
  }

  async excluir(p: PerfilAcesso): Promise<void> {
    const ok = await this.alertas.confirmarExclusao({
      texto: `Excluir perfil "${p.nome}"?`,
    });
    if (!ok) return;
    this.api.excluirPerfil(p.id).subscribe({
      next: () => {
        this.mensagem.set('Perfil removido.');
        this.carregar();
      },
      error: (err: HttpErrorResponse) =>
        this.erro.set(err.error?.mensagem || 'Erro ao excluir.'),
    });
  }

  modulosLabel(p: PerfilAcesso): string {
    if (!p.modulos.length) return '—';
    return p.modulos.join(', ');
  }
}
