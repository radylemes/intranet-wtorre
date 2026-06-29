import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { AlertasService } from '../../../services/alertas.service';
import { AuthService } from '../../../services/auth.service';
import { ColaboradoresService } from '../../../services/colaboradores.service';
import { ColaboradorAdmin } from '../../../models/colaborador.model';
import { empresaParaClasse, labelEmpresa } from '../../../utils/empresa-classe.util';

type AtivoFiltro = '1' | '0' | 'todos';

@Component({
  selector: 'app-colaboradores-admin',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './colaboradores-admin.component.html',
  styleUrl: './colaboradores-admin.component.scss',
})
export class ColaboradoresAdminComponent implements OnInit {
  private readonly colaboradoresService = inject(ColaboradoresService);
  private readonly alertas = inject(AlertasService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly busca$ = new Subject<string>();

  readonly colaboradores = signal<ColaboradorAdmin[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = signal(50);
  readonly carregando = signal(false);
  readonly sincronizando = signal(false);
  readonly stats = signal<{ ativos: number; inativos: number; ultima_sync: string | null } | null>(
    null
  );

  readonly buscaTexto = signal('');
  readonly filtroEmpresa = signal('');
  readonly filtroDepartamento = signal('');
  readonly filtroAtivo = signal<AtivoFiltro>('1');

  readonly empresas = signal<string[]>([]);
  readonly departamentos = signal<string[]>([]);

  readonly drawerAberto = signal(false);
  readonly detalhe = signal<ColaboradorAdmin | null>(null);
  readonly detalheCarregando = signal(false);
  readonly fotoUrls = signal<Record<number, string>>({});

  readonly mensagem = signal('');
  readonly erro = signal('');

  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / this.limit())));
  readonly ultimaSyncLabel = computed(() => {
    const raw = this.stats()?.ultima_sync;
    if (!raw) return 'Nunca';
    try {
      return new Date(raw).toLocaleString('pt-BR');
    } catch {
      return raw;
    }
  });

  readonly isAdmin = computed(() => this.auth.isAdmin());

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
    this.carregarStats();
    this.carregarFiltros();
    this.carregarLista();

    this.busca$
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => {
        this.page.set(1);
        this.carregarLista();
      });
  }

  carregarStats(): void {
    this.colaboradoresService.obterStats().subscribe({
      next: (s) => this.stats.set(s),
      error: () => {},
    });
  }

  carregarFiltros(): void {
    this.colaboradoresService.getDepartamentos().subscribe({
      next: (list) => this.departamentos.set(list),
    });
    this.colaboradoresService.getDiretorio().subscribe({
      next: (res) => {
        const set = new Set<string>();
        for (const c of res.colaboradores) {
          if (c.empresa) set.add(c.empresa);
        }
        this.empresas.set([...set].sort((a, b) => a.localeCompare(b, 'pt-BR')));
      },
    });
  }

  carregarLista(): void {
    this.carregando.set(true);
    this.colaboradoresService
      .listarAdmin({
        busca: this.buscaTexto(),
        empresa: this.filtroEmpresa() || undefined,
        departamento: this.filtroDepartamento() || undefined,
        ativo: this.filtroAtivo(),
        page: this.page(),
        limit: this.limit(),
      })
      .subscribe({
        next: (res) => {
          this.colaboradores.set(res.colaboradores);
          this.total.set(res.total);
          this.page.set(res.page);
          this.carregando.set(false);
          this.carregarFotos(res.colaboradores);
        },
        error: (err: HttpErrorResponse) => {
          this.carregando.set(false);
          this.erro.set(err.error?.mensagem || 'Erro ao carregar colaboradores.');
        },
      });
  }

  private carregarFotos(list: ColaboradorAdmin[]): void {
    for (const c of list) {
      if (c.tem_foto === false || this.fotoUrls()[c.id]) continue;
      this.colaboradoresService.fotoObjectUrl(c.id).then((url) => {
        if (!url) return;
        this.fotoUrls.update((m) => ({ ...m, [c.id]: url }));
      });
    }
  }

  onBuscaInput(value: string): void {
    this.buscaTexto.set(value);
    this.busca$.next(value);
  }

  onFiltroChange(): void {
    this.page.set(1);
    this.carregarLista();
  }

  paginaAnterior(): void {
    if (this.page() <= 1) return;
    this.page.update((p) => p - 1);
    this.carregarLista();
  }

  paginaProxima(): void {
    if (this.page() >= this.totalPaginas()) return;
    this.page.update((p) => p + 1);
    this.carregarLista();
  }

  sincronizar(): void {
    if (this.sincronizando()) return;
    this.sincronizando.set(true);
    this.colaboradoresService.sincronizar().subscribe({
      next: (resumo) => {
        this.sincronizando.set(false);
        const erros = resumo.erros?.length ?? 0;
        this.mensagem.set(
          `Sincronização concluída: ${resumo.total} registro(s) atualizado(s)` +
            (erros ? ` (${erros} tenant(s) com erro)` : '') +
            '.'
        );
        this.carregarStats();
        this.carregarLista();
      },
      error: (err: HttpErrorResponse) => {
        this.sincronizando.set(false);
        this.erro.set(err.error?.mensagem || 'Erro ao sincronizar.');
      },
    });
  }

  abrirDetalhe(c: ColaboradorAdmin): void {
    this.detalheCarregando.set(true);
    this.drawerAberto.set(true);
    this.colaboradoresService.obterAdmin(c.id).subscribe({
      next: (full) => {
        this.detalhe.set(full);
        this.detalheCarregando.set(false);
        if (full.tem_foto !== false) {
          this.colaboradoresService.fotoObjectUrl(full.id).then((url) => {
            if (url) this.fotoUrls.update((m) => ({ ...m, [full.id]: url }));
          });
        }
      },
      error: (err: HttpErrorResponse) => {
        this.detalheCarregando.set(false);
        this.drawerAberto.set(false);
        this.erro.set(err.error?.mensagem || 'Erro ao carregar detalhes.');
      },
    });
  }

  fecharDrawer(): void {
    this.drawerAberto.set(false);
    this.detalhe.set(null);
  }

  irParaAcessos(provisionar: boolean): void {
    const c = this.detalhe();
    if (!c) return;

    const queryParams: Record<string, string> = { colaborador_id: String(c.id) };
    if (provisionar) {
      queryParams['provisionar'] = '1';
    } else if (c.intranet.usuario_id) {
      queryParams['usuario_id'] = String(c.intranet.usuario_id);
    }

    this.router.navigate(['/admin/acessos'], { queryParams });
  }

  empresaClasse(empresa: string | null | undefined): string {
    return empresaParaClasse(empresa);
  }

  empresaLabel(empresa: string | null | undefined): string {
    return labelEmpresa(empresa);
  }

  formatAniversario(c: ColaboradorAdmin): string {
    if (!c.nasc_dia || !c.nasc_mes) return '—';
    const dia = String(c.nasc_dia).padStart(2, '0');
    const mes = String(c.nasc_mes).padStart(2, '0');
    const ano = c.nasc_ano ? `/${c.nasc_ano}` : '';
    return `${dia}/${mes}${ano}`;
  }

  formatData(value: string | null | undefined): string {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString('pt-BR');
    } catch {
      return value;
    }
  }

  iniciais(nome: string): string {
    return nome
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  }
}
