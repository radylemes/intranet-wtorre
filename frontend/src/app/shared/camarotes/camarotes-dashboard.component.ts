import { Component, Input, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  CamaroteUnidade,
  CamarotesDashboard,
  SituacaoUnidade,
} from '../../models/camarote.model';
import { CamarotesService } from '../../services/camarotes.service';
import { AlertasService } from '../../services/alertas.service';
import {
  CamarotesKpiModalComponent,
  KpiModalModo,
} from './camarotes-kpi-modal.component';
import { formatarAndar, normalizarAndarChave } from '../../utils/camarote-andar.util';

const TIPOS_ORDEM = ['Cessionário', 'Patrocinador', 'SEP', 'Outros'] as const;

const CORES_TIPO: Record<string, string> = {
  Cessionário: 'var(--wtorre)',
  Patrocinador: 'var(--warn, #e0a52e)',
  SEP: 'var(--status-green)',
  Outros: 'var(--ink-dim)',
};

interface ModalDrilldownConfig {
  titulo: string;
  subtitulo: string;
  modo: KpiModalModo;
  fetch: { tipo: 'camarote'; situacao?: SituacaoUnidade; setor?: string };
  filtro?: (u: CamaroteUnidade) => boolean;
  countEsperado?: number;
  vazioMsg?: string;
}

interface KpiConfig {
  titulo: string;
  subtitulo: (diasVenceBreve: number) => string;
  modo: KpiModalModo;
  contagem: (dashboard: CamarotesDashboard) => number;
}

const KPI_CONFIG: Record<SituacaoUnidade, KpiConfig> = {
  vencido: {
    titulo: 'Contratos vencidos',
    subtitulo: () => 'Unidades com contrato vencido — exigem renovação imediata',
    modo: 'contrato',
    contagem: (d) => d.camarotes.alertas.vencidos,
  },
  vence_breve: {
    titulo: 'Vencem em breve',
    subtitulo: (dias) => `Contratos que vencem nos próximos ${dias} dias`,
    modo: 'contrato',
    contagem: (d) => d.camarotes.alertas.vence_breve,
  },
  vago: {
    titulo: 'Camarotes vagos',
    subtitulo: () => 'Unidades disponíveis para locação',
    modo: 'vago',
    contagem: (d) => d.camarotes.alertas.vagos,
  },
  ativo: {
    titulo: 'Ocupados',
    subtitulo: () => 'Contratos ativos em operação',
    modo: 'contrato',
    contagem: (d) => d.camarotes.alertas.ativos,
  },
};

function temCessionario(u: CamaroteUnidade): boolean {
  const c = u.cessionario?.trim().toLowerCase() || '';
  return !!c && c !== '-' && c !== 'vago' && c !== '—';
}

@Component({
  selector: 'app-camarotes-dashboard',
  standalone: true,
  imports: [DecimalPipe, CamarotesKpiModalComponent],
  templateUrl: './camarotes-dashboard.component.html',
  styleUrl: './camarotes-dashboard.component.scss',
})
export class CamarotesDashboardComponent {
  @Input({ required: true }) dashboard!: CamarotesDashboard;

  private readonly camarotesService = inject(CamarotesService);
  private readonly alertas = inject(AlertasService);

  readonly setores = ['Oeste', 'Norte', 'Leste', 'Sul'];

  readonly modalAberto = signal(false);
  readonly modalCarregando = signal(false);
  readonly modalErro = signal('');
  readonly modalUnidades = signal<CamaroteUnidade[]>([]);
  readonly modalTitulo = signal('');
  readonly modalSubtitulo = signal('');
  readonly modalModo = signal<KpiModalModo>('contrato');

  moeda(valor: number | null | undefined): string {
    if (valor == null) return '—';
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  totalUnidades(): number {
    const a = this.dashboard.camarotes.alertas;
    return a.ativos + a.vagos + a.vencidos + a.vence_breve;
  }

  ocupacaoPct(): number {
    const total = this.totalUnidades();
    if (!total) return 0;
    return Math.round((this.dashboard.camarotes.alertas.ativos / total) * 100);
  }

  kpiClickable(situacao: SituacaoUnidade): boolean {
    return KPI_CONFIG[situacao].contagem(this.dashboard) > 0;
  }

  abrirKpi(situacao: SituacaoUnidade): void {
    const config = KPI_CONFIG[situacao];
    this.abrirModal({
      titulo: config.titulo,
      subtitulo: config.subtitulo(this.dashboard.dias_vence_breve),
      modo: config.modo,
      fetch: { tipo: 'camarote', situacao },
      countEsperado: config.contagem(this.dashboard),
    });
  }

  abrirPack30(comPack30: boolean): void {
    const count = comPack30
      ? this.dashboard.camarotes.pack30.com_pack30
      : this.dashboard.camarotes.pack30.sem_pack30;
    this.abrirModal({
      titulo: comPack30 ? 'Com Pack30' : 'Sem Pack30',
      subtitulo: `${count} unidade(s) com contrato ativo`,
      modo: 'pack30',
      fetch: { tipo: 'camarote' },
      filtro: (u) => temCessionario(u) && u.pack30 === comPack30,
      countEsperado: count,
    });
  }

  abrirVvip(): void {
    const total = this.dashboard.camarotes.vagas_vvip.total_vagas;
    this.abrirModal({
      titulo: 'Vagas VVIP',
      subtitulo: `${total} vaga(s) em contratos com cessionário`,
      modo: 'vvip',
      fetch: { tipo: 'camarote' },
      filtro: (u) => (u.vagas_vvip ?? 0) > 0,
      countEsperado: total,
    });
  }

  abrirSetor(setor: string): void {
    const count = this.totalSetor(setor);
    this.abrirModal({
      titulo: `Vagos — Setor ${setor}`,
      subtitulo: `${count} camarote(s) disponível(is)`,
      modo: 'vago',
      fetch: { tipo: 'camarote', setor, situacao: 'vago' },
      countEsperado: count,
    });
  }

  abrirTodosVagos(): void {
    const count = this.totalVagos();
    this.abrirModal({
      titulo: 'Camarotes vagos',
      subtitulo: `${count} unidade(s) disponível(is) para locação`,
      modo: 'vago',
      fetch: { tipo: 'camarote', situacao: 'vago' },
      countEsperado: count,
    });
  }

  abrirTipoCessionario(nome: string, quantidade: number): void {
    this.abrirModal({
      titulo: `Tipo — ${nome}`,
      subtitulo: `${quantidade} contrato(s) ativo(s)`,
      modo: 'contrato',
      fetch: { tipo: 'camarote' },
      filtro: (u) =>
        temCessionario(u) && this.normalizarTipoCessionario(u.tipo_cessionario) === nome,
      countEsperado: quantidade,
    });
  }

  abrirAndarTipo(andarUi: string, tipoNome: string, qtd: number): void {
    this.abrirModal({
      titulo: `${andarUi} — ${tipoNome}`,
      subtitulo: `${qtd} contrato(s) neste andar e tipo`,
      modo: 'contrato',
      fetch: { tipo: 'camarote' },
      filtro: (u) =>
        temCessionario(u) &&
        this.matchAndar(andarUi, u.andar) &&
        this.matchTipoRaw(tipoNome, u.tipo_cessionario),
      countEsperado: qtd,
    });
  }

  onKpiKeydown(event: KeyboardEvent, situacao: SituacaoUnidade): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.abrirKpi(situacao);
    }
  }

  onDrilldownKeydown(event: KeyboardEvent, action: () => void): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  }

  fecharKpi(): void {
    this.modalAberto.set(false);
    this.modalCarregando.set(false);
    this.modalErro.set('');
    this.modalUnidades.set([]);
  }

  vvipClickable(): boolean {
    return (this.dashboard.camarotes.vagas_vvip.total_vagas ?? 0) > 0;
  }

  pack30Clickable(com: boolean): boolean {
    return com
      ? this.dashboard.camarotes.pack30.com_pack30 > 0
      : this.dashboard.camarotes.pack30.sem_pack30 > 0;
  }

  private abrirModal(config: ModalDrilldownConfig): void {
    const count = config.countEsperado ?? 0;
    if (count <= 0) {
      this.alertas.sucesso(config.vazioMsg || 'Nenhuma unidade nesta categoria.');
      return;
    }

    this.modalTitulo.set(config.titulo);
    this.modalSubtitulo.set(config.subtitulo);
    this.modalModo.set(config.modo);
    this.modalUnidades.set([]);
    this.modalErro.set('');
    this.modalCarregando.set(true);
    this.modalAberto.set(true);

    this.camarotesService.unidades(config.fetch).subscribe({
      next: (lista) => {
        const filtrada = config.filtro ? lista.filter(config.filtro) : lista;
        this.modalUnidades.set(this.ordenarUnidades(filtrada));
        this.modalCarregando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.modalErro.set(err.error?.mensagem || 'Erro ao carregar unidades.');
        this.modalCarregando.set(false);
      },
    });
  }

  private normalizarTipoCessionario(valor: string | null | undefined): string {
    const s = String(valor || '').toLowerCase();
    if (s.includes('patroc')) return 'Patrocinador';
    if (s.includes('sep')) return 'SEP';
    if (s.includes('cess')) return 'Cessionário';
    return 'Outros';
  }

  private matchAndar(andarUi: string, andarDb: string | null | undefined): boolean {
    const ui = normalizarAndarChave(andarUi);
    const db = normalizarAndarChave(andarDb);
    if (!ui || !db) return ui === db;
    return ui === db;
  }

  private matchTipoRaw(tipoTag: string, tipoDb: string | null | undefined): boolean {
    const db = String(tipoDb || '').trim();
    if (!db) return tipoTag === 'Outros';
    if (db === tipoTag) return true;
    return this.normalizarTipoCessionario(db) === this.normalizarTipoCessionario(tipoTag);
  }

  private ordenarUnidades(lista: CamaroteUnidade[]): CamaroteUnidade[] {
    return [...lista].sort((a, b) => {
      const setor = (a.setor || '').localeCompare(b.setor || '', 'pt-BR');
      if (setor !== 0) return setor;
      return a.numero.localeCompare(b.numero, 'pt-BR', { numeric: true });
    });
  }

  totalSetor(setor: string): number {
    return this.dashboard.camarotes.disponiveis_por_setor?.[setor]?.total ?? 0;
  }

  numerosSetor(setor: string): string[] {
    return this.dashboard.camarotes.disponiveis_por_setor?.[setor]?.numeros ?? [];
  }

  maxVagosSetor(): number {
    return Math.max(...this.setores.map((s) => this.totalSetor(s)), 1);
  }

  barWidthSetor(setor: string): number {
    const max = this.maxVagosSetor();
    if (!max) return 0;
    return Math.round((this.totalSetor(setor) / max) * 100);
  }

  totalVagos(): number {
    return this.dashboard.camarotes.alertas.vagos;
  }

  tiposOrdenados(): Array<{ nome: string; quantidade: number; valor_total: number }> {
    const resumo = this.dashboard.camarotes.tipo_cessionario.resumo;
    const seen = new Set<string>();
    const result: Array<{ nome: string; quantidade: number; valor_total: number }> = [];

    for (const nome of TIPOS_ORDEM) {
      if (resumo[nome]) {
        result.push({ nome, ...resumo[nome] });
        seen.add(nome);
      }
    }
    for (const [nome, data] of Object.entries(resumo)) {
      if (!seen.has(nome)) {
        result.push({ nome, ...data });
      }
    }
    return result;
  }

  maxQtdTipo(): number {
    const tipos = this.tiposOrdenados();
    return Math.max(...tipos.map((t) => t.quantidade), 1);
  }

  barWidthTipo(qtd: number): number {
    const max = this.maxQtdTipo();
    if (!max) return 0;
    return Math.round((qtd / max) * 100);
  }

  corTipo(tipo: string): string {
    return CORES_TIPO[tipo] ?? CORES_TIPO['Outros'];
  }

  qtdAtivos(): number {
    return this.dashboard.camarotes.metricas.qtd_ativos;
  }

  pack30Total(): number {
    const p = this.dashboard.camarotes.pack30;
    return p.com_pack30 + p.sem_pack30;
  }

  pack30PctCom(): number {
    const total = this.pack30Total();
    if (!total) return 0;
    return Math.round((this.dashboard.camarotes.pack30.com_pack30 / total) * 100);
  }

  andaresEntries(): Array<{ andar: string; tipos: Array<{ nome: string; qtd: number }> }> {
    const porAndar = this.dashboard.camarotes.tipo_cessionario.por_andar;
    if (!porAndar) return [];

    return Object.entries(porAndar)
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR', { numeric: true }))
      .map(([andar, tipos]) => ({
        andar: this.formatarAndar(andar),
        tipos: Object.entries(tipos)
          .sort(([a], [b]) => {
            const ia = TIPOS_ORDEM.indexOf(a as (typeof TIPOS_ORDEM)[number]);
            const ib = TIPOS_ORDEM.indexOf(b as (typeof TIPOS_ORDEM)[number]);
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
          })
          .map(([nome, qtd]) => ({ nome, qtd })),
      }));
  }

  formatarAndar = formatarAndar;
}
