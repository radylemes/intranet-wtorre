import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { AlertasService } from '../../../services/alertas.service';
import { AuthService } from '../../../services/auth.service';
import { CamarotesService } from '../../../services/camarotes.service';
import { PerfisAcessoService } from '../../../services/perfis-acesso.service';
import {
  CamarotesAba,
  CamarotesAlertaContrato,
  CamarotesAlertasResumo,
  CamarotesAlertasEnvioLog,
  CamarotesAlertasEnvioDestinatario,
  CamarotesConfig,
  CamarotesGatilho,
  CamarotesStatusEntrega,
  CamarotesSyncLog,
  CamarotesTemplateCodigo,
  CamarotesVisualizador,
} from '../../../models/camarote.model';
import { ColaboradorBusca } from '../../../models/perfil-acesso.model';

const GATILHOS_DEFAULT: CamarotesGatilho[] = [
  {
    dias: 90,
    template_codigo: '90dias',
    assunto: 'Camarote Nº [XXX] — Vencimento em 90 dias',
    ativo: true,
  },
  {
    dias: 30,
    template_codigo: '30dias',
    assunto: 'Camarote Nº [XXX] — Vencimento em 30 dias',
    ativo: true,
  },
  {
    dias: 0,
    template_codigo: 'hoje',
    assunto: 'Camarote Nº [XXX] — Vence hoje',
    ativo: true,
  },
];

interface GatilhoUiMeta {
  dias: 90 | 30 | 0;
  titulo: string;
  badge: string;
  cardClass: string;
  headClass: string;
  badgeClass: string;
}

const GATILHO_UI: GatilhoUiMeta[] = [
  {
    dias: 90,
    titulo: '90 dias',
    badge: 'Baixa urgência',
    cardClass: 'on-green',
    headClass: 'th-green',
    badgeClass: 'tbadge-green',
  },
  {
    dias: 30,
    titulo: '30 dias',
    badge: 'Atenção',
    cardClass: 'on-purple',
    headClass: 'th-purple',
    badgeClass: 'tbadge-purple',
  },
  {
    dias: 0,
    titulo: 'Hoje / vencidos',
    badge: 'Urgente',
    cardClass: 'on-dark',
    headClass: 'th-dark',
    badgeClass: 'tbadge-dark',
  },
];

interface DestinatarioAlerta {
  email: string;
  nome: string;
  tag: string;
}

const AVATAR_PALETTE = ['#820ad1', '#0f8a6d', '#c2410c', '#1d6fd6', '#b7256b', '#5b21b6'];

function nomeFromEmail(email: string): string {
  const local = email.split('@')[0] || email;
  return local
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function tagFromEmail(email: string): string {
  const domain = (email.split('@')[1] || '').toLowerCase();
  if (domain.includes('nubankparque')) return 'Nubank Parque';
  if (domain.includes('wtorre')) return 'WTorre';
  if (domain.includes('wtentretenimento')) return 'Entretenimento';
  const part = domain.split('.')[0];
  if (!part) return 'E-mail';
  return part.charAt(0).toUpperCase() + part.slice(1);
}

function chipFromEmail(email: string): DestinatarioAlerta {
  const normalized = email.trim().toLowerCase();
  return { email: normalized, nome: nomeFromEmail(normalized), tag: tagFromEmail(normalized) };
}

function chipFromColab(c: ColaboradorBusca): DestinatarioAlerta {
  const email = c.email!.trim().toLowerCase();
  const tag = (c.empresa || c.departamento || tagFromEmail(email)).trim();
  return { email, nome: c.nome.trim(), tag };
}

function iniciaisDestinatario(nome: string): string {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function corAvatarDestinatario(seed: string): string {
  const idx = [...seed].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx];
}

@Component({
  selector: 'app-camarotes-admin',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './camarotes-admin.component.html',
  styleUrl: './camarotes-admin.component.scss',
})
export class CamarotesAdminComponent implements OnInit {
  private readonly camarotesService = inject(CamarotesService);
  private readonly perfisService = inject(PerfisAcessoService);
  private readonly auth = inject(AuthService);
  private readonly alertas = inject(AlertasService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly busca$ = new Subject<string>();
  private readonly buscaEmail$ = new Subject<string>();

  readonly gatilhoUi = GATILHO_UI;
  readonly templateOpcoes: { value: CamarotesTemplateCodigo; label: string }[] = [
    { value: '90dias', label: 'camarote-90dias.html' },
    { value: '30dias', label: 'camarote-30dias.html' },
    { value: 'hoje', label: 'camarote-hoje.html' },
  ];

  readonly abaAtiva = signal<CamarotesAba>('alertas');
  readonly config = signal<CamarotesConfig | null>(null);
  readonly syncLogs = signal<CamarotesSyncLog[]>([]);
  readonly alertasLogs = signal<CamarotesAlertasEnvioLog[]>([]);
  readonly filtroGatilhoDisparos = signal<'todos' | 90 | 30 | 0>('todos');
  readonly carregandoDisparos = signal(false);
  readonly contratosAlerta = signal<CamarotesAlertaContrato[]>([]);
  readonly contratosResumo = signal<CamarotesAlertasResumo | null>(null);
  readonly contratosPendentes = signal(0);
  readonly filtroGatilhoContratos = signal<'todos' | 90 | 30 | 0>('todos');
  readonly filtroNotificadoContratos = signal<'todos' | 'sim' | 'nao'>('todos');
  readonly carregandoContratosAlerta = signal(false);
  readonly disparandoContratoKey = signal<string | null>(null);
  readonly visualizadores = signal<CamarotesVisualizador[]>([]);
  readonly resultadosBusca = signal<ColaboradorBusca[]>([]);
  readonly resultadosBuscaEmail = signal<ColaboradorBusca[]>([]);
  readonly buscaTexto = signal('');
  readonly buscaEmailTexto = signal('');
  readonly carregando = signal(false);
  readonly sincronizando = signal(false);
  readonly salvandoConfig = signal(false);
  readonly enviando = signal(false);
  readonly adicionandoVisualizador = signal(false);
  readonly mensagem = signal('');
  readonly erro = signal('');

  readonly destinatarios = signal<DestinatarioAlerta[]>([]);
  readonly cadencia = signal<'diaria' | 'semanal'>('diaria');
  readonly horarioEnvio = signal('08:00');
  readonly envioAtivo = signal(true);
  readonly syncAutomatica = signal(true);
  readonly syncFrequencia = signal<'1h' | '6h' | '12h' | '24h' | 'semanal'>('24h');
  readonly envioAposSync = signal(false);
  readonly gatilhos = signal<CamarotesGatilho[]>([...GATILHOS_DEFAULT]);
  readonly sharepointUrl = signal('');
  readonly sharepointSheet = signal('Camarotes');
  readonly salvandoSharepoint = signal(false);

  readonly previewAberto = signal(false);
  readonly previewTitulo = signal('');
  readonly previewHtml = signal<SafeHtml | null>(null);
  readonly previewGatilhoDias = signal<90 | 30 | 0 | null>(null);
  readonly previewDestinatario = signal('');
  readonly carregandoPreview = signal(false);
  readonly enviandoTestePreview = signal(false);

  readonly ultimaSyncLabel = computed(() => {
    const d = this.config()?.ultima_sync;
    return d ? new Date(d).toLocaleString('pt-BR') : 'Nunca sincronizado';
  });

  readonly alertasLogsFiltrados = computed(() => {
    const filtro = this.filtroGatilhoDisparos();
    const logs = this.alertasLogs();
    if (filtro === 'todos') return logs;
    return logs.filter((log) => log.gatilho_dias === filtro);
  });

  readonly destinatariosCountLabel = computed(() => {
    const n = this.destinatarios().length;
    return n === 1 ? '1 destinatário' : `${n} destinatários`;
  });

  readonly visualizadoresCountLabel = computed(() => {
    const n = this.visualizadores().length;
    return n === 1 ? '1 visualizador' : `${n} visualizadores`;
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
    this.carregarTudo();

    this.busca$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) =>
          q.trim().length >= 2 ? this.perfisService.buscarColaboradores(q.trim()) : of([])
        )
      )
      .subscribe({
        next: (list) => this.resultadosBusca.set(list),
        error: () => this.erro.set('Erro na busca de colaboradores.'),
      });

    this.buscaEmail$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) =>
          q.trim().length >= 2 ? this.perfisService.buscarColaboradores(q.trim()) : of([])
        )
      )
      .subscribe({
        next: (list) => this.resultadosBuscaEmail.set(list),
        error: () => this.erro.set('Erro na busca de colaboradores.'),
      });
  }

  selecionarAba(aba: CamarotesAba): void {
    this.abaAtiva.set(aba);
    if (aba === 'disparos') {
      this.carregarDisparos();
    }
    if (aba === 'contratos') {
      this.carregarContratosAlerta();
    }
  }

  metaSituacaoEnvio(situacao: CamarotesAlertaContrato['situacao_envio']): { label: string; badgeClass: string } {
    switch (situacao) {
      case 'notificado':
        return { label: 'Enviado', badgeClass: 'sbadge-ok' };
      case 'no_prazo':
        return { label: 'No prazo', badgeClass: 'sbadge-info' };
      case 'atrasado':
        return { label: 'Atrasado', badgeClass: 'sbadge-warn' };
      default:
        return { label: 'Pendente', badgeClass: 'sbadge-pend' };
    }
  }

  formatDiasRestantes(dias: number): string {
    const n = Number(dias);
    if (n > 1) return `${n} dias para o vencimento`;
    if (n === 1) return '1 dia para o vencimento';
    if (n === 0) return 'Vence hoje';
    const abs = Math.abs(n);
    return abs === 1 ? 'Vencido há 1 dia' : `Vencido há ${abs} dias`;
  }

  labelGatilhoContrato(c: CamarotesAlertaContrato): string {
    if (c.dias_restantes === 0) return 'Vence hoje';
    if (c.gatilho_dias === 0) return 'Vencido';
    return this.labelGatilho(c.gatilho_dias);
  }

  labelGatilho(dias: 90 | 30 | 0): string {
    if (dias === 0) return 'Hoje / vencidos';
    return `${dias} dias`;
  }

  metaGatilho(dias: number): GatilhoUiMeta | undefined {
    return this.gatilhoUi.find((g) => g.dias === dias);
  }

  metaStatusEntrega(status: CamarotesStatusEntrega): { label: string; badgeClass: string; title?: string } {
    switch (status) {
      case 'entregue':
        return { label: 'Entregue', badgeClass: 'tbadge-ok' };
      case 'enviado':
        return {
          label: 'Enviado',
          badgeClass: 'tbadge-info',
          title: 'Aceito pelo provedor; confirmação de entrega depende do ACS + webhook.',
        };
      case 'bounce':
        return { label: 'Bounce', badgeClass: 'tbadge-warn' };
      case 'falha':
        return { label: 'Falha', badgeClass: 'tbadge-error' };
      case 'parcial':
        return { label: 'Parcial', badgeClass: 'tbadge-warn', title: 'Alguns destinatários falharam ou retornaram bounce.' };
      case 'legado':
      default:
        return {
          label: 'Sem rastreio',
          badgeClass: 'tbadge-muted',
          title: 'Disparo anterior à ativação do rastreamento por destinatário.',
        };
    }
  }

  resumoDestinatarios(log: CamarotesAlertasEnvioLog): string {
    if (!log.destinatarios?.length) return '—';
    return log.destinatarios.map((d) => d.destinatario).join(', ');
  }

  labelStatusDestinatario(status: CamarotesAlertasEnvioDestinatario['status']): string {
    return this.metaStatusEntrega(status).label;
  }

  detalheStatusEntrega(log: CamarotesAlertasEnvioLog): string | undefined {
    if (!log.destinatarios?.length) return this.metaStatusEntrega(log.status_entrega).title;
    const linhas = log.destinatarios.map((d) => {
      const status = this.metaStatusEntrega(d.status).label;
      return d.erro ? `${d.destinatario}: ${status} — ${d.erro}` : `${d.destinatario}: ${status}`;
    });
    return linhas.join('\n');
  }

  gatilhoPorDias(dias: 90 | 30 | 0): CamarotesGatilho {
    return (
      this.gatilhos().find((g) => g.dias === dias) || {
        dias,
        template_codigo: dias === 90 ? '90dias' : dias === 30 ? '30dias' : 'hoje',
        assunto: '',
        ativo: false,
      }
    );
  }

  atualizarGatilho(dias: 90 | 30 | 0, patch: Partial<CamarotesGatilho>): void {
    this.gatilhos.update((lista) =>
      lista.map((g) => (g.dias === dias ? { ...g, ...patch, dias } : g))
    );
  }

  private aplicarConfig(c: CamarotesConfig): void {
    this.config.set(c);
    this.destinatarios.set((c.emails_alerta || []).map(chipFromEmail));
    this.cadencia.set(c.cadencia);
    this.horarioEnvio.set(c.horario_envio || '08:00');
    this.envioAtivo.set(c.envio_ativo);
    this.syncAutomatica.set(c.sync_automatica ?? true);
    this.syncFrequencia.set(c.sync_frequencia ?? '24h');
    this.envioAposSync.set(c.envio_apos_sync ?? false);
    this.sharepointUrl.set(c.sharepoint_url || '');
    this.sharepointSheet.set(c.sharepoint_sheet || 'Camarotes');
    if (c.gatilhos?.length) {
      this.gatilhos.set(
        GATILHOS_DEFAULT.map((def) => {
          const found = c.gatilhos!.find((g) => g.dias === def.dias);
          return found ? { ...def, ...found } : def;
        })
      );
    }
  }

  carregarTudo(): void {
    this.carregando.set(true);
    this.camarotesService.obterConfig().subscribe({
      next: (c) => this.aplicarConfig(c),
      error: (err: HttpErrorResponse) =>
        this.erro.set(err.error?.mensagem || 'Erro ao carregar configuração.'),
    });
    this.camarotesService.syncLog().subscribe({
      next: (logs) => this.syncLogs.set(logs),
      error: (err: HttpErrorResponse) =>
        this.erro.set(err.error?.mensagem || 'Erro ao carregar histórico de sincronizações.'),
    });
    this.carregarDisparos();
    this.camarotesService.listarVisualizadores().subscribe({
      next: (lista) => this.visualizadores.set(lista),
      error: (err: HttpErrorResponse) =>
        this.erro.set(err.error?.mensagem || 'Erro ao carregar visualizadores.'),
      complete: () => this.carregando.set(false),
    });
  }

  carregarDisparos(): void {
    this.carregandoDisparos.set(true);
    this.camarotesService.alertasEnvioLog(100).subscribe({
      next: (logs) => {
        this.alertasLogs.set(logs);
        this.carregandoDisparos.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.erro.set(err.error?.mensagem || 'Erro ao carregar histórico de disparos.');
        this.carregandoDisparos.set(false);
      },
    });
  }

  carregarContratosAlerta(): void {
    const gatilho = this.filtroGatilhoContratos();
    const notif = this.filtroNotificadoContratos();

    this.carregandoContratosAlerta.set(true);
    this.camarotesService
      .alertasContratos({
        gatilho_dias: gatilho === 'todos' ? undefined : gatilho,
        notificado: notif === 'sim' ? true : notif === 'nao' ? false : undefined,
      })
      .subscribe({
        next: (res) => {
          this.contratosAlerta.set(res.itens);
          this.contratosPendentes.set(res.pendentes);
          if (res.resumo) this.contratosResumo.set(res.resumo);
          this.carregandoContratosAlerta.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.erro.set(err.error?.mensagem || 'Erro ao carregar contratos em alerta.');
          this.carregandoContratosAlerta.set(false);
        },
      });
  }

  onFiltroContratosChange(): void {
    this.carregarContratosAlerta();
  }

  filtrarContratosPorGatilho(gatilho: 'todos' | 90 | 30 | 0): void {
    this.filtroGatilhoContratos.set(gatilho);
    this.carregarContratosAlerta();
  }

  contratoDisparoKey(c: CamarotesAlertaContrato): string {
    return `${c.unidade_id}-${c.gatilho_dias}`;
  }

  dispararContrato(c: CamarotesAlertaContrato): void {
    const key = this.contratoDisparoKey(c);
    this.disparandoContratoKey.set(key);
    this.camarotesService
      .enviarAlertas(false, { gatilho_dias: c.gatilho_dias, unidade_id: c.unidade_id }, c.notificado)
      .subscribe({
        next: (res) => {
          this.disparandoContratoKey.set(null);
          if (res.enviado) {
            this.mensagem.set(`Alerta enviado para o camarote Nº ${c.numero}.`);
            this.carregarContratosAlerta();
            this.carregarDisparos();
          } else {
            this.erro.set(res.motivo || 'Nenhum envio realizado.');
          }
        },
        error: (err: HttpErrorResponse) => {
          this.disparandoContratoKey.set(null);
          this.erro.set(err.error?.mensagem || 'Erro ao disparar alerta.');
        },
      });
  }

  onBuscaInput(valor: string): void {
    this.buscaTexto.set(valor);
    this.busca$.next(valor);
  }

  onBuscaEmailInput(valor: string): void {
    this.buscaEmailTexto.set(valor);
    this.buscaEmail$.next(valor);
  }

  onBuscaEmailKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const valor = this.buscaEmailTexto().trim();
    if (!valor.includes('@')) return;
    this.adicionarEmailManual(valor);
  }

  iniciaisDestinatario = iniciaisDestinatario;
  corAvatarDestinatario = corAvatarDestinatario;

  tagVisualizador(v: CamarotesVisualizador): string {
    const dept = v.departamento?.trim();
    if (dept) return dept;
    return tagFromEmail(v.email);
  }

  adicionarEmailDestino(colab: ColaboradorBusca): void {
    if (!colab.email) {
      this.erro.set('Colaborador sem e-mail cadastrado.');
      return;
    }
    const chip = chipFromColab(colab);
    if (this.destinatarios().some((d) => d.email === chip.email)) {
      this.erro.set('Este e-mail já está na lista.');
      return;
    }
    this.destinatarios.update((lista) => [...lista, chip]);
    this.buscaEmailTexto.set('');
    this.resultadosBuscaEmail.set([]);
  }

  adicionarEmailManual(email: string): void {
    const chip = chipFromEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(chip.email)) {
      this.erro.set('Informe um e-mail válido.');
      return;
    }
    if (this.destinatarios().some((d) => d.email === chip.email)) {
      this.erro.set('Este e-mail já está na lista.');
      return;
    }
    this.destinatarios.update((lista) => [...lista, chip]);
    this.buscaEmailTexto.set('');
    this.resultadosBuscaEmail.set([]);
  }

  removerDestinatario(email: string): void {
    const normalized = email.trim().toLowerCase();
    this.destinatarios.update((lista) => lista.filter((d) => d.email !== normalized));
  }

  adicionarVisualizador(colab: ColaboradorBusca): void {
    if (!colab.email) {
      this.erro.set('Colaborador sem e-mail não pode receber acesso.');
      return;
    }

    const email = colab.email.toLowerCase();
    const jaExiste = this.visualizadores().some((v) => v.email.toLowerCase() === email);
    if (jaExiste) {
      this.erro.set('Este colaborador já possui acesso de visualização.');
      return;
    }

    this.adicionandoVisualizador.set(true);
    this.camarotesService.adicionarVisualizador({ colaborador_id: colab.id }).subscribe({
      next: (v) => {
        this.visualizadores.update((lista) =>
          [...lista, v].sort((a, b) => a.nome_completo.localeCompare(b.nome_completo, 'pt-BR'))
        );
        this.buscaTexto.set('');
        this.resultadosBusca.set([]);
        this.mensagem.set(`${v.nome_completo} adicionado como visualizador.`);
        this.adicionandoVisualizador.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.erro.set(err.error?.mensagem || 'Erro ao adicionar visualizador.');
        this.adicionandoVisualizador.set(false);
      },
    });
  }

  async removerVisualizador(v: CamarotesVisualizador): Promise<void> {
    const ok = await this.alertas.confirmar({
      titulo: 'Remover visualizador',
      texto: `Remover o acesso de ${v.nome_completo}?`,
      confirmar: 'Remover',
    });
    if (!ok) return;

    this.camarotesService.removerVisualizador(v.usuario_id).subscribe({
      next: () => {
        this.visualizadores.update((lista) => lista.filter((x) => x.usuario_id !== v.usuario_id));
        this.mensagem.set('Visualizador removido.');
      },
      error: (err: HttpErrorResponse) =>
        this.erro.set(err.error?.mensagem || 'Erro ao remover visualizador.'),
    });
  }

  async sincronizar(): Promise<void> {
    const ok = await this.alertas.confirmar({
      titulo: 'Sincronizar planilha',
      texto: 'Importar dados do SharePoint agora? Os registros atuais de camarotes serão substituídos.',
      confirmar: 'Sincronizar',
    });
    if (!ok) return;

    this.sincronizando.set(true);
    this.camarotesService.sincronizar().subscribe({
      next: () => {
        this.mensagem.set('Sincronização concluída.');
        this.carregarTudo();
        this.sincronizando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.erro.set(err.error?.mensagem || 'Erro na sincronização.');
        this.camarotesService.syncLog().subscribe({ next: (logs) => this.syncLogs.set(logs) });
        this.sincronizando.set(false);
      },
    });
  }

  salvarConfig(): void {
    const emails = this.destinatarios().map((d) => d.email);

    this.salvandoConfig.set(true);
    this.camarotesService
      .salvarConfig({
        emails_alerta: emails,
        dias_vence_breve: this.config()?.dias_vence_breve ?? 90,
        cadencia: this.cadencia(),
        horario_envio: this.horarioEnvio(),
        envio_ativo: this.envioAtivo(),
        sync_automatica: this.syncAutomatica(),
        sync_frequencia: this.syncFrequencia(),
        envio_apos_sync: this.envioAposSync(),
        gatilhos: this.gatilhos(),
      })
      .subscribe({
        next: (c) => {
          this.aplicarConfig(c);
          this.mensagem.set('Configuração salva.');
          this.salvandoConfig.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.erro.set(err.error?.mensagem || 'Erro ao salvar configuração.');
          this.salvandoConfig.set(false);
        },
      });
  }

  previewGatilho(dias: 90 | 30 | 0): void {
    const meta = this.gatilhoUi.find((g) => g.dias === dias);
    this.carregandoPreview.set(true);
    this.previewGatilhoDias.set(dias);
    this.previewDestinatario.set(this.auth.usuario()?.email || '');
    this.previewTitulo.set(`Template — gatilho ${meta?.titulo || dias}`);
    this.camarotesService.previewGatilho(dias).subscribe({
      next: (res) => {
        this.previewHtml.set(this.sanitizer.bypassSecurityTrustHtml(res.html));
        this.previewAberto.set(true);
        this.carregandoPreview.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.erro.set(err.error?.mensagem || 'Erro ao gerar pré-visualização.');
        this.carregandoPreview.set(false);
      },
    });
  }

  enviarTestePreview(): void {
    const dias = this.previewGatilhoDias();
    if (dias == null) return;

    const destinatario = this.previewDestinatario().trim();
    this.enviandoTestePreview.set(true);
    this.erro.set('');

    this.camarotesService.enviarTesteGatilho(dias, destinatario || undefined).subscribe({
      next: (res) => {
        this.mensagem.set(res.mensagem || 'E-mail de teste enviado.');
        this.enviandoTestePreview.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.erro.set(err.error?.mensagem || 'Falha ao enviar e-mail de teste.');
        this.enviandoTestePreview.set(false);
      },
    });
  }

  salvarSharepoint(): void {
    this.salvandoSharepoint.set(true);
    this.camarotesService
      .salvarConfig({
        sharepoint_url: this.sharepointUrl().trim() || null,
        sharepoint_sheet: this.sharepointSheet().trim() || 'Camarotes',
      })
      .subscribe({
        next: (c) => {
          this.aplicarConfig(c);
          this.mensagem.set('Configuração do SharePoint salva.');
          this.salvandoSharepoint.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.erro.set(err.error?.mensagem || 'Erro ao salvar.');
          this.salvandoSharepoint.set(false);
        },
      });
  }

  copiarErro(texto: string | undefined): void {
    if (!texto) return;
    navigator.clipboard.writeText(texto).then(
      () => this.mensagem.set('Erro copiado para a área de transferência.'),
      () => this.erro.set('Não foi possível copiar. Tente manualmente.'),
    );
  }

  fecharPreview(): void {
    this.previewAberto.set(false);
    this.previewHtml.set(null);
    this.previewGatilhoDias.set(null);
  }

  async enviarAlertas(): Promise<void> {
    const ok = await this.alertas.confirmar({
      titulo: 'Enviar alertas',
      texto: 'Disparar e-mails pendentes para os gatilhos ativos?',
      confirmar: 'Enviar',
    });
    if (!ok) return;

    this.enviando.set(true);
    this.camarotesService.enviarAlertas(false).subscribe({
      next: (res) => {
        this.enviando.set(false);
        if (res.enviado) {
          this.mensagem.set(`${res.enviados} alerta(s) enviado(s).`);
        } else {
          this.alertas.sucesso(res.motivo || 'Nenhum envio realizado.');
        }
        this.carregarTudo();
        if (this.abaAtiva() === 'contratos') {
          this.carregarContratosAlerta();
        }
      },
      error: (err: HttpErrorResponse) => {
        this.erro.set(err.error?.mensagem || 'Erro ao enviar alertas.');
        this.enviando.set(false);
      },
    });
  }
}
