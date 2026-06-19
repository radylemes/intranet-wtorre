import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, Observable } from 'rxjs';
import { AdminDrawerComponent } from '../../../shared/admin/admin-drawer/admin-drawer.component';
import { AlertasService } from '../../../services/alertas.service';
import { PerfisAcessoService } from '../../../services/perfis-acesso.service';
import {
  ColaboradorBusca,
  ModuloAdmin,
  PerfilAcesso,
  UsuarioAcesso,
} from '../../../models/perfil-acesso.model';

@Component({
  selector: 'app-acessos-admin',
  standalone: true,
  imports: [FormsModule, AdminDrawerComponent],
  templateUrl: './acessos-admin.component.html',
  styleUrl: './acessos-admin.component.scss',
})
export class AcessosAdminComponent implements OnInit {
  private readonly api = inject(PerfisAcessoService);
  private readonly alertas = inject(AlertasService);
  private readonly busca$ = new Subject<string>();

  readonly usuarios = signal<UsuarioAcesso[]>([]);
  readonly perfis = signal<PerfilAcesso[]>([]);
  readonly modulos = signal<ModuloAdmin[]>([]);
  readonly resultadosBusca = signal<ColaboradorBusca[]>([]);
  readonly buscaTexto = signal('');
  readonly mensagem = signal('');
  readonly erro = signal('');
  readonly salvando = signal(false);
  readonly drawerAberto = signal(false);

  readonly editando = signal<UsuarioAcesso | null>(null);
  readonly colaboradorNovo = signal<ColaboradorBusca | null>(null);
  readonly perfisSelecionados = signal<number[]>([]);
  readonly modulosExtra = signal<string[]>([]);
  readonly usuarioAtivo = signal(true);
  readonly isSuperAdmin = signal(false);

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
    this.api.listarPerfis().subscribe({
      next: (list) => this.perfis.set(list.filter((p) => p.ativo)),
    });
    this.api.listarModulos().subscribe({
      next: (list) => this.modulos.set(list),
    });

    this.busca$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => (q.trim().length >= 2 ? this.api.buscarColaboradores(q.trim()) : of([])))
      )
      .subscribe({
        next: (list) => this.resultadosBusca.set(list),
        error: () => this.erro.set('Erro na busca de colaboradores.'),
      });
  }

  carregar(): void {
    this.api.listarUsuarios().subscribe({
      next: (list) => this.usuarios.set(list),
      error: (err: HttpErrorResponse) =>
        this.erro.set(err.error?.mensagem || 'Erro ao carregar usuários.'),
    });
  }

  onBuscaInput(value: string): void {
    this.buscaTexto.set(value);
    this.busca$.next(value);
  }

  abrirColaborador(c: ColaboradorBusca): void {
    if (c.usuario_id) {
      this.api.obterUsuario(c.usuario_id).subscribe({
        next: (u) => this.abrirDrawer(u),
        error: (err: HttpErrorResponse) =>
          this.erro.set(err.error?.mensagem || 'Erro ao carregar usuário.'),
      });
    } else {
      this.colaboradorNovo.set(c);
      this.editando.set(null);
      this.perfisSelecionados.set([]);
      this.modulosExtra.set([]);
      this.usuarioAtivo.set(true);
      this.isSuperAdmin.set(false);
      this.drawerAberto.set(true);
    }
  }

  abrirUsuario(u: UsuarioAcesso): void {
    this.abrirDrawer(u);
  }

  private abrirDrawer(u: UsuarioAcesso): void {
    this.colaboradorNovo.set(null);
    this.editando.set(u);
    this.perfisSelecionados.set(u.perfis.map((p) => p.id));
    this.modulosExtra.set([...u.modulos_extra]);
    this.usuarioAtivo.set(u.ativo);
    this.isSuperAdmin.set(u.perfil === 'ADMIN');
    this.drawerAberto.set(true);
  }

  fecharDrawer(): void {
    this.drawerAberto.set(false);
    this.editando.set(null);
    this.colaboradorNovo.set(null);
  }

  togglePerfil(id: number): void {
    this.perfisSelecionados.update((list) =>
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
    );
  }

  toggleModuloExtra(codigo: string): void {
    this.modulosExtra.update((list) =>
      list.includes(codigo) ? list.filter((c) => c !== codigo) : [...list, codigo]
    );
  }

  salvar(): void {
    const u = this.editando();
    const colab = this.colaboradorNovo();
    const id = u?.id ?? 0;
    const eraSuperAdmin = u?.perfil === 'ADMIN';
    const querSuperAdmin = this.isSuperAdmin();

    this.salvando.set(true);

    this.executarSalvamento(id, colab, eraSuperAdmin, querSuperAdmin).subscribe({
      next: (salvo) => {
        if (salvo.id && salvo.ativo !== this.usuarioAtivo()) {
          this.api.patchAtivo(salvo.id, this.usuarioAtivo()).subscribe({
            next: () => this.finalizarSalvamento(),
            error: (err: HttpErrorResponse) => {
              this.erro.set(err.error?.mensagem || 'Erro ao atualizar status.');
              this.salvando.set(false);
            },
          });
        } else {
          this.finalizarSalvamento();
        }
      },
      error: (err: HttpErrorResponse) => {
        this.erro.set(err.error?.mensagem || 'Erro ao salvar acessos.');
        this.salvando.set(false);
      },
    });
  }

  private executarSalvamento(
    id: number,
    colab: ColaboradorBusca | null,
    eraSuperAdmin: boolean,
    querSuperAdmin: boolean
  ): Observable<UsuarioAcesso> {
    const provisionar = (): Observable<UsuarioAcesso> => {
      if (id > 0) {
        return of(this.editando()!);
      }
      return this.api.salvarUsuario(0, {
        perfil_ids: querSuperAdmin ? [] : this.perfisSelecionados(),
        modulos_extra: querSuperAdmin ? [] : this.modulosExtra(),
        colaborador_id: colab?.id,
      });
    };

    if (querSuperAdmin) {
      return provisionar().pipe(
        switchMap((salvo) => {
          if (!eraSuperAdmin || salvo.perfil !== 'ADMIN') {
            return this.api.patchPerfil(salvo.id, 'ADMIN');
          }
          return of(salvo);
        })
      );
    }

    if (eraSuperAdmin) {
      return this.api.patchPerfil(id, 'USER').pipe(
        switchMap((salvo) =>
          this.api.salvarUsuario(salvo.id, {
            perfil_ids: this.perfisSelecionados(),
            modulos_extra: this.modulosExtra(),
          })
        )
      );
    }

    return this.api.salvarUsuario(id, {
      perfil_ids: this.perfisSelecionados(),
      modulos_extra: this.modulosExtra(),
      colaborador_id: colab?.id,
    });
  }

  private finalizarSalvamento(): void {
    this.mensagem.set('Acessos salvos.');
    this.fecharDrawer();
    this.carregar();
    this.salvando.set(false);
  }

  drawerTitulo(): string {
    const u = this.editando();
    const c = this.colaboradorNovo();
    return u?.nome_completo ?? c?.nome ?? 'Usuário';
  }

  modulosLabel(u: UsuarioAcesso): string {
    if (u.perfil === 'ADMIN') return 'Todos os módulos';
    if (!u.modulos.length) return '—';
    return u.modulos.join(', ');
  }

  perfisLabel(u: UsuarioAcesso): string {
    if (u.perfil === 'ADMIN') return 'Super Admin';
    if (!u.perfis.length) return '—';
    return u.perfis.map((p) => p.nome).join(', ');
  }

  async excluir(u: UsuarioAcesso): Promise<void> {
    const ok = await this.alertas.confirmarExclusao({
      texto: `Excluir o usuário "${u.nome_completo}"? Esta ação não pode ser desfeita.`,
    });
    if (!ok) return;
    this.api.excluirUsuario(u.id).subscribe({
      next: () => {
        if (this.editando()?.id === u.id) {
          this.fecharDrawer();
        }
        this.mensagem.set('Usuário excluído.');
        this.carregar();
      },
      error: (err: HttpErrorResponse) =>
        this.erro.set(err.error?.mensagem || 'Erro ao excluir usuário.'),
    });
  }
}
