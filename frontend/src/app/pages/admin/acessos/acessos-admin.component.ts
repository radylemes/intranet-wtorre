import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { AdminDrawerComponent } from '../../../shared/admin/admin-drawer/admin-drawer.component';
import { AdminToastService } from '../../../shared/admin/admin-toast/admin-toast.service';
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
  private readonly toast = inject(AdminToastService);
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

    this.salvando.set(true);
    this.api
      .salvarUsuario(id, {
        perfil_ids: this.perfisSelecionados(),
        modulos_extra: this.modulosExtra(),
        colaborador_id: colab?.id,
      })
      .subscribe({
        next: (salvo) => {
          if (salvo.id && salvo.ativo !== this.usuarioAtivo()) {
            this.api.patchAtivo(salvo.id, this.usuarioAtivo()).subscribe({
              next: () => {
                this.mensagem.set('Acessos salvos.');
                this.fecharDrawer();
                this.carregar();
                this.salvando.set(false);
              },
              error: (err: HttpErrorResponse) => {
                this.erro.set(err.error?.mensagem || 'Erro ao atualizar status.');
                this.salvando.set(false);
              },
            });
          } else {
            this.mensagem.set('Acessos salvos.');
            this.fecharDrawer();
            this.carregar();
            this.salvando.set(false);
          }
        },
        error: (err: HttpErrorResponse) => {
          this.erro.set(err.error?.mensagem || 'Erro ao salvar acessos.');
          this.salvando.set(false);
        },
      });
  }

  drawerTitulo(): string {
    const u = this.editando();
    const c = this.colaboradorNovo();
    return u?.nome_completo ?? c?.nome ?? 'Usuário';
  }

  modulosLabel(u: UsuarioAcesso): string {
    if (!u.modulos.length) return '—';
    return u.modulos.join(', ');
  }
}
