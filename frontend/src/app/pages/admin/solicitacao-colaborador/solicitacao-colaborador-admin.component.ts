import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { DatePipe, NgClass } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { AlertasService } from '../../../services/alertas.service';
import { SolicitacaoColaboradorService } from '../../../services/solicitacao-colaborador.service';
import {
  SolicitacaoCampo,
  SolicitacaoColaborador,
  SolicitacaoEnvio,
  SolicitacaoGrupo,
  SolicitacaoVisualizador,
  UsuarioAdBusca,
} from '../../../models/solicitacao-colaborador.model';

@Component({
  selector: 'app-solicitacao-colaborador-admin',
  standalone: true,
  imports: [FormsModule, DatePipe, NgClass],
  templateUrl: './solicitacao-colaborador-admin.component.html',
  styleUrl: './solicitacao-colaborador-admin.component.scss',
})
export class SolicitacaoColaboradorAdminComponent implements OnInit {
  private readonly service = inject(SolicitacaoColaboradorService);
  private readonly alertas = inject(AlertasService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly busca$ = new Subject<string>();
  private readonly buscaDestinatarios$ = new Subject<string>();

  readonly carregando = signal(false);
  readonly mensagem = signal('');
  readonly erro = signal('');

  readonly campos = signal<SolicitacaoCampo[]>([]);
  readonly grupos = signal<SolicitacaoGrupo[]>([]);
  readonly visualizadores = signal<SolicitacaoVisualizador[]>([]);
  readonly solicitacoes = signal<SolicitacaoColaborador[]>([]);

  /** null = fechado; -1 = novo grupo; id > 0 = editando */
  readonly editandoGrupoId = signal<number | null>(null);
  readonly salvandoGrupo = signal(false);
  readonly grupoNome = signal('');
  readonly grupoDestinatarios = signal<string[]>([]);
  readonly grupoEmailNovo = signal('');
  readonly grupoCamposSel = signal<string[]>([]);
  readonly grupoAtivo = signal(true);
  readonly grupoOrdem = signal(0);

  readonly adicionarViewerAberto = signal(false);
  readonly resultadosBusca = signal<UsuarioAdBusca[]>([]);
  readonly buscaTexto = signal('');
  readonly resultadosDestinatarios = signal<UsuarioAdBusca[]>([]);
  readonly buscaDestinatariosTexto = signal('');
  readonly adicionandoVisualizador = signal(false);

  readonly expandedSolicitacaoId = signal<number | null>(null);
  readonly enviosPorSolicitacao = signal<Record<number, SolicitacaoEnvio[]>>({});
  readonly carregandoEnvios = signal<number | null>(null);

  readonly previewHtml = signal<SafeHtml | ''>('');
  readonly previewAberto = signal(false);

  readonly camposDisponiveis = computed(() => this.campos());
  readonly editorAberto = computed(() => this.editandoGrupoId() !== null);
  readonly editandoNovo = computed(() => this.editandoGrupoId() === -1);

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
    this.carregarTudo();
    const buscaAd = (q: string) =>
      q.trim().length >= 2 ? this.service.buscarUsuariosAd(q.trim()) : of([]);

    this.busca$
      .pipe(debounceTime(300), distinctUntilChanged(), switchMap(buscaAd))
      .subscribe({
        next: (list) => this.resultadosBusca.set(list),
        error: () => this.erro.set('Erro na busca de colaboradores.'),
      });

    this.buscaDestinatarios$
      .pipe(debounceTime(300), distinctUntilChanged(), switchMap(buscaAd))
      .subscribe({
        next: (list) => this.resultadosDestinatarios.set(list),
        error: () => this.erro.set('Erro na busca de destinatários.'),
      });
  }

  carregarTudo(): void {
    this.carregando.set(true);
    this.service.listarCampos().subscribe({
      next: (c) => this.campos.set(c),
      error: () => {},
    });
    this.service.listarGrupos().subscribe({
      next: (g) => this.grupos.set(g),
      error: (e: HttpErrorResponse) => this.erro.set(e.error?.mensagem || 'Erro ao carregar grupos.'),
    });
    this.service.listarVisualizadores().subscribe({
      next: (v) => this.visualizadores.set(v),
      error: (e: HttpErrorResponse) =>
        this.erro.set(e.error?.mensagem || 'Erro ao carregar visualizadores.'),
    });
    this.service.listarSolicitacoesAdmin().subscribe({
      next: (s) => {
        this.solicitacoes.set(s);
        this.carregando.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.carregando.set(false);
        this.erro.set(e.error?.mensagem || 'Erro ao carregar histórico.');
      },
    });
  }

  labelCampo(chave: string): string {
    return this.campos().find((c) => c.chave === chave)?.label || chave;
  }

  isArquivo(chave: string): boolean {
    return this.campos().find((c) => c.chave === chave)?.tipo === 'file';
  }

  iniciais(nome: string): string {
    return (nome || '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('');
  }

  resumoDestinatarios(emails: string[]): string {
    if (!emails?.length) return '—';
    if (emails.length === 1) return this.truncarEmail(emails[0]);
    return `${this.truncarEmail(emails[0])} +${emails.length - 1}`;
  }

  truncarEmail(email: string): string {
    const parts = email.split('@');
    if (parts[0].length <= 8) return email;
    return `${parts[0].slice(0, 6)}…@${parts[1] || ''}`;
  }

  novoGrupo(): void {
    this.editandoGrupoId.set(-1);
    this.grupoNome.set('');
    this.grupoDestinatarios.set([]);
    this.grupoEmailNovo.set('');
    this.buscaDestinatariosTexto.set('');
    this.resultadosDestinatarios.set([]);
    this.grupoCamposSel.set([]);
    this.grupoAtivo.set(true);
    this.grupoOrdem.set(this.grupos().length);
  }

  editarGrupo(g: SolicitacaoGrupo): void {
    this.editandoGrupoId.set(g.id);
    this.grupoNome.set(g.nome);
    this.grupoDestinatarios.set([...g.destinatarios]);
    this.grupoEmailNovo.set('');
    this.buscaDestinatariosTexto.set('');
    this.resultadosDestinatarios.set([]);
    this.grupoCamposSel.set([...g.campos]);
    this.grupoAtivo.set(g.ativo);
    this.grupoOrdem.set(g.ordem);
  }

  cancelarEditor(): void {
    this.editandoGrupoId.set(null);
    this.buscaDestinatariosTexto.set('');
    this.resultadosDestinatarios.set([]);
  }

  toggleCampoGrupo(chave: string): void {
    const atual = this.grupoCamposSel();
    if (atual.includes(chave)) {
      this.grupoCamposSel.set(atual.filter((c) => c !== chave));
    } else {
      this.grupoCamposSel.set([...atual, chave]);
    }
  }

  adicionarEmailGrupo(): void {
    const email = this.grupoEmailNovo().trim().toLowerCase();
    if (!email) return;
    this.adicionarEmailDestinatario(email);
    this.grupoEmailNovo.set('');
  }

  adicionarDestinatarioDoAd(col: UsuarioAdBusca): void {
    const email = col.email?.trim().toLowerCase();
    if (!email) {
      this.erro.set('Colaborador sem e-mail cadastrado no AD.');
      return;
    }
    this.adicionarEmailDestinatario(email);
    this.buscaDestinatariosTexto.set('');
    this.resultadosDestinatarios.set([]);
  }

  private adicionarEmailDestinatario(email: string): void {
    if (this.grupoDestinatarios().includes(email)) {
      this.erro.set('E-mail já adicionado.');
      return;
    }
    this.grupoDestinatarios.update((list) => [...list, email]);
  }

  onBuscaDestinatario(q: string): void {
    this.buscaDestinatariosTexto.set(q);
    this.buscaDestinatarios$.next(q);
  }

  removerEmailGrupo(email: string): void {
    this.grupoDestinatarios.update((list) => list.filter((e) => e !== email));
  }

  onEmailGrupoKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.adicionarEmailGrupo();
    }
  }

  salvarGrupo(): void {
    const nome = this.grupoNome().trim();
    if (!nome) {
      this.erro.set('Informe o nome do grupo.');
      return;
    }
    if (!this.grupoDestinatarios().length) {
      this.erro.set('Adicione ao menos um destinatário.');
      return;
    }
    if (!this.grupoCamposSel().length) {
      this.erro.set('Selecione ao menos um campo.');
      return;
    }

    const body = {
      nome,
      destinatarios: this.grupoDestinatarios(),
      campos: this.grupoCamposSel(),
      ativo: this.grupoAtivo(),
      ordem: this.grupoOrdem(),
    };

    this.salvandoGrupo.set(true);
    const id = this.editandoGrupoId();
    const req =
      id && id > 0 ? this.service.atualizarGrupo(id, body) : this.service.criarGrupo(body);

    req.subscribe({
      next: () => {
        this.salvandoGrupo.set(false);
        this.editandoGrupoId.set(null);
        this.mensagem.set(id && id > 0 ? 'Grupo atualizado.' : 'Grupo criado.');
        this.service.listarGrupos().subscribe({ next: (g) => this.grupos.set(g) });
      },
      error: (e: HttpErrorResponse) => {
        this.salvandoGrupo.set(false);
        this.erro.set(e.error?.mensagem || 'Erro ao salvar grupo.');
      },
    });
  }

  toggleGrupoAtivo(g: SolicitacaoGrupo): void {
    const novoAtivo = !g.ativo;
    this.service
      .atualizarGrupo(g.id, {
        nome: g.nome,
        destinatarios: g.destinatarios,
        campos: g.campos,
        ativo: novoAtivo,
        ordem: g.ordem,
      })
      .subscribe({
        next: (updated) => {
          this.grupos.update((list) => list.map((x) => (x.id === g.id ? updated : x)));
        },
        error: (e: HttpErrorResponse) => this.erro.set(e.error?.mensagem || 'Erro ao atualizar grupo.'),
      });
  }

  excluirGrupo(g: SolicitacaoGrupo): void {
    this.alertas.confirmarExclusao({ texto: `Excluir o grupo "${g.nome}"?` }).then((ok) => {
      if (!ok) return;
      this.service.removerGrupo(g.id).subscribe({
        next: () => {
          this.mensagem.set('Grupo excluído.');
          this.grupos.update((list) => list.filter((x) => x.id !== g.id));
          if (this.editandoGrupoId() === g.id) this.editandoGrupoId.set(null);
        },
        error: (e: HttpErrorResponse) => this.erro.set(e.error?.mensagem || 'Erro ao excluir.'),
      });
    });
  }

  abrirAdicionarViewer(): void {
    this.adicionarViewerAberto.set(true);
    this.buscaTexto.set('');
    this.resultadosBusca.set([]);
  }

  onBuscaVisualizador(q: string): void {
    this.buscaTexto.set(q);
    this.busca$.next(q);
  }

  adicionarVisualizador(col: UsuarioAdBusca): void {
    if (!col.email?.trim()) {
      this.erro.set('Colaborador sem e-mail cadastrado.');
      return;
    }
    const email = col.email.toLowerCase();
    if (this.visualizadores().some((v) => v.email.toLowerCase() === email)) {
      this.erro.set('Este colaborador já possui acesso de visualização.');
      return;
    }
    this.adicionandoVisualizador.set(true);
    this.service.adicionarVisualizador({ colaborador_id: col.id }).subscribe({
      next: (v) => {
        this.adicionandoVisualizador.set(false);
        this.visualizadores.update((list) =>
          [...list, v].sort((a, b) => a.nome_completo.localeCompare(b.nome_completo, 'pt-BR'))
        );
        this.adicionarViewerAberto.set(false);
        this.buscaTexto.set('');
        this.resultadosBusca.set([]);
        this.mensagem.set('Visualizador adicionado.');
      },
      error: (e: HttpErrorResponse) => {
        this.adicionandoVisualizador.set(false);
        this.erro.set(e.error?.mensagem || 'Erro ao adicionar visualizador.');
      },
    });
  }

  removerVisualizador(v: SolicitacaoVisualizador): void {
    this.alertas
      .confirmar({
        titulo: 'Remover visualizador',
        texto: `Remover o acesso de ${v.nome_completo}?`,
        confirmar: 'Remover',
      })
      .then((ok) => {
        if (!ok) return;
        this.service.removerVisualizador(v.usuario_id).subscribe({
          next: () => {
            this.visualizadores.update((list) =>
              list.filter((x) => x.usuario_id !== v.usuario_id)
            );
            this.mensagem.set('Visualizador removido.');
          },
          error: (e: HttpErrorResponse) => this.erro.set(e.error?.mensagem || 'Erro ao remover.'),
        });
      });
  }

  toggleDetalhes(s: SolicitacaoColaborador): void {
    if (this.expandedSolicitacaoId() === s.id) {
      this.expandedSolicitacaoId.set(null);
      return;
    }
    this.expandedSolicitacaoId.set(s.id);
    if (this.enviosPorSolicitacao()[s.id]) return;

    this.carregandoEnvios.set(s.id);
    this.service.obterSolicitacaoAdmin(s.id).subscribe({
      next: (d) => {
        this.enviosPorSolicitacao.update((map) => ({
          ...map,
          [s.id]: this.ultimosEnviosPorGrupo(d.envios),
        }));
        this.carregandoEnvios.set(null);
      },
      error: (e: HttpErrorResponse) => {
        this.carregandoEnvios.set(null);
        this.erro.set(e.error?.mensagem || 'Erro ao carregar envios.');
      },
    });
  }

  /** Mantém o envio mais recente de cada grupo para exibição no expand. */
  private ultimosEnviosPorGrupo(envios: SolicitacaoEnvio[]): SolicitacaoEnvio[] {
    const map = new Map<string, SolicitacaoEnvio>();
    for (const e of envios) {
      const key = String(e.grupo_id ?? e.grupo_nome);
      const prev = map.get(key);
      if (!prev || (e.enviado_em && prev.enviado_em && e.enviado_em > prev.enviado_em)) {
        map.set(key, e);
      }
    }
    return [...map.values()];
  }

  enviosExpandidos(id: number): SolicitacaoEnvio[] {
    return this.enviosPorSolicitacao()[id] || [];
  }

  previewGrupo(solicitacaoId: number, grupoId: number | null | undefined): void {
    if (!grupoId) return;
    this.service.previewEmail(solicitacaoId, grupoId).subscribe({
      next: (r) => {
        this.previewHtml.set(this.sanitizer.bypassSecurityTrustHtml(r.html));
        this.previewAberto.set(true);
      },
      error: (e: HttpErrorResponse) => this.erro.set(e.error?.mensagem || 'Erro no preview.'),
    });
  }

  reenviarGrupo(solicitacaoId: number, grupoId: number | null | undefined, nome: string): void {
    if (!grupoId) return;
    this.alertas
      .confirmar({
        titulo: 'Reenviar e-mail',
        texto: `Reenviar e-mail do grupo "${nome}"?`,
        confirmar: 'Reenviar',
      })
      .then((ok) => {
        if (!ok) return;
        this.service.reenviarEmail(solicitacaoId, grupoId).subscribe({
          next: () => {
            this.mensagem.set('Reenvio solicitado.');
            this.service.obterSolicitacaoAdmin(solicitacaoId).subscribe({
              next: (d) => {
                this.enviosPorSolicitacao.update((map) => ({
                  ...map,
                  [solicitacaoId]: this.ultimosEnviosPorGrupo(d.envios),
                }));
              },
            });
          },
          error: (e: HttpErrorResponse) => this.erro.set(e.error?.mensagem || 'Erro no reenvio.'),
        });
      });
  }

  fecharPreview(): void {
    this.previewAberto.set(false);
    this.previewHtml.set('');
  }

  badgeClass(status: string): string {
    if (status === 'enviada') return 'b-ok';
    if (status === 'parcial') return 'b-parcial';
    return 'b-erro';
  }

  labelStatus(status: string): string {
    const map: Record<string, string> = {
      recebida: 'Recebida',
      enviada: 'Enviada',
      parcial: 'Parcial',
      erro: 'Erro',
    };
    return map[status] || status;
  }

  labelTipo(tipo: string): string {
    const map: Record<string, string> = {
      novo: 'Novo',
      reposicao: 'Reposição',
      mudanca: 'Mudança',
    };
    return map[tipo] || tipo;
  }
}
