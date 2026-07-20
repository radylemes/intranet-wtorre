import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { PublicChromeComponent } from '../../shared/public-chrome/public-chrome.component';
import { FooterComponent } from '../../shared/footer/footer.component';
import { AuthService } from '../../services/auth.service';
import { FollowupService } from '../../services/followup.service';
import {
  FollowupFamilia,
  FollowupFilial,
  FollowupResumoItem,
  FollowupSolicitacao,
} from '../../models/followup.model';

export type CardTone = 'ok' | 'run' | 'wait' | 'off';

export interface MsgView {
  lead: string;
  pill: string | null;
  body: string;
  showHowto: boolean;
}

export interface FilialChip {
  codigo: string;
  nome: string | null;
  qtd: number;
}

export interface StatGroup {
  key: CardTone;
  label: string;
  qtd: number;
}

function iniciais(nome: string): string {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

function fmtMoeda(v: number | null | undefined): string {
  if (v == null) return '—';
  return `R$ ${Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDataBr(value: string | null | undefined): string | null {
  if (!value) return null;
  const iso = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return String(value);
}

function familiaToTone(familia: FollowupFamilia | string | null | undefined): CardTone {
  switch (familia) {
    case 'ok':
      return 'ok';
    case 'wait':
      return 'run';
    case 'bad':
      return 'off';
    default:
      return 'wait';
  }
}

function parseMensagem(r: FollowupSolicitacao): MsgView {
  const raw = String(r.mensagem || '').trim();
  if (!raw) {
    return { lead: r.status_geral || '—', pill: null, body: '', showHowto: false };
  }

  const lines = raw
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const howtoIdx = lines.findIndex((l) => /mega|recebimentos|consultar a nf/i.test(l));
  const contentLines = howtoIdx >= 0 ? lines.slice(0, howtoIdx) : lines;
  const showHowto = howtoIdx >= 0;

  let lead = contentLines[0] || r.status_geral || '—';
  let pill: string | null = null;

  const codigoMatch = lead.match(/(?:codigo|código|pedido)\s*:?\s*#?\s*([0-9]+)/i);
  if (codigoMatch) {
    pill = codigoMatch[1];
    lead = lead
      .replace(codigoMatch[0], '')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .replace(/[:\-–—]\s*$/, '');
    if (!lead) lead = 'Pedido criado';
  } else if (r.pedido_contrato) {
    pill = String(r.pedido_contrato);
    if (/pedido criado/i.test(lead)) lead = 'Pedido criado';
  }

  const body = contentLines.slice(1).join(' ');

  return { lead, pill, body, showHowto };
}

@Component({
  selector: 'app-followup-suprimentos',
  standalone: true,
  imports: [PublicChromeComponent, FooterComponent, FormsModule, RouterLink],
  templateUrl: './followup-suprimentos.component.html',
  styleUrl: './followup-suprimentos.component.scss',
})
export class FollowupSuprimentosComponent implements OnInit {
  private readonly followup = inject(FollowupService);
  readonly auth = inject(AuthService);

  readonly carregando = signal(false);
  readonly erro = signal('');
  readonly solicitacoes = signal<FollowupSolicitacao[]>([]);
  readonly resumo = signal<FollowupResumoItem[]>([]);
  readonly filiais = signal<FollowupFilial[]>([]);
  readonly filialFiltro = signal<string | null>(null);
  readonly busca = signal('');
  readonly modoBusca = signal(false);
  readonly contexto = signal('Suas solicitações');
  readonly buscaNumero = signal<string | null>(null);

  readonly podeAdmin = computed(() => this.auth.hasModulo('followup-suprimentos'));

  readonly login = computed(() => {
    const u = this.auth.usuario();
    if (!u) return '—';
    const email = (u.email || '').trim().toLowerCase();
    if (email.includes('@')) return email.split('@')[0];
    return (u.username || '—').toLowerCase();
  });

  readonly nomeExibicao = computed(() => {
    const u = this.auth.usuario();
    return u?.nome_completo?.trim() || this.login();
  });

  readonly avatarIniciais = computed(() => iniciais(this.nomeExibicao()));

  readonly listaExibida = computed(() => {
    const filtro = this.filialFiltro();
    const rows = this.solicitacoes();
    if (!filtro) return rows;
    return rows.filter((r) => String(r.cod_filial || '') === filtro);
  });

  readonly total = computed(() => {
    if (this.modoBusca() || this.filialFiltro()) return this.listaExibida().length;
    const fromResumo = this.resumo().reduce((acc, r) => acc + r.qtd, 0);
    return fromResumo || this.solicitacoes().length;
  });

  readonly stats = computed((): StatGroup[] => {
    const counts: Record<CardTone, number> = { ok: 0, run: 0, wait: 0, off: 0 };
    const source = this.modoBusca() ? this.solicitacoes() : null;

    if (source) {
      for (const r of source) {
        counts[familiaToTone(r.familia)] += 1;
      }
    } else if (this.resumo().length) {
      for (const item of this.resumo()) {
        counts[familiaToTone(item.familia)] += item.qtd;
      }
    } else {
      for (const r of this.solicitacoes()) {
        counts[familiaToTone(r.familia)] += 1;
      }
    }

    const groups: StatGroup[] = [
      { key: 'ok', label: 'Atendidas', qtd: counts.ok },
      { key: 'run', label: 'Em andamento', qtd: counts.run },
      { key: 'wait', label: 'Aguardando', qtd: counts.wait },
      { key: 'off', label: 'Devolvidas', qtd: counts.off },
    ];
    return groups.filter((s) => s.qtd > 0);
  });

  readonly filiaisChips = computed((): FilialChip[] => {
    const map = new Map<string, FilialChip>();
    for (const r of this.solicitacoes()) {
      const cod = (r.cod_filial || '').trim();
      if (!cod) continue;
      const cur = map.get(cod);
      if (cur) cur.qtd += 1;
      else map.set(cod, { codigo: cod, nome: r.nome_filial || null, qtd: 1 });
    }

    for (const f of this.filiais()) {
      if (!map.has(f.codigo)) {
        map.set(f.codigo, { codigo: f.codigo, nome: f.nome, qtd: 0 });
      } else if (f.nome && !map.get(f.codigo)!.nome) {
        map.get(f.codigo)!.nome = f.nome;
      }
    }

    return [...map.values()]
      .filter((f) => f.qtd > 0)
      .sort((a, b) => {
        const na = Number(a.codigo);
        const nb = Number(b.codigo);
        if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
        return a.codigo.localeCompare(b.codigo, 'pt-BR');
      });
  });

  ngOnInit(): void {
    this.carregarMinhas();
  }

  carregarMinhas(): void {
    this.carregando.set(true);
    this.erro.set('');
    this.modoBusca.set(false);
    this.busca.set('');
    this.buscaNumero.set(null);
    this.filialFiltro.set(null);
    this.contexto.set('Suas solicitações');

    let pending = 3;
    const done = () => {
      pending -= 1;
      if (pending <= 0) this.carregando.set(false);
    };

    this.followup.minhas().subscribe({
      next: (rows) => {
        this.solicitacoes.set(rows);
        done();
      },
      error: (err: HttpErrorResponse) => {
        this.erro.set(err.error?.mensagem || 'Erro ao carregar solicitações.');
        this.solicitacoes.set([]);
        done();
      },
    });

    this.followup.resumo().subscribe({
      next: (itens) => {
        this.resumo.set(itens);
        done();
      },
      error: () => {
        this.resumo.set([]);
        done();
      },
    });

    this.followup.filiais().subscribe({
      next: (itens) => {
        this.filiais.set(itens);
        done();
      },
      error: () => {
        this.filiais.set([]);
        done();
      },
    });
  }

  selecionarFilial(codigo: string | null): void {
    this.filialFiltro.set(codigo);
  }

  pesquisar(): void {
    const q = this.busca().trim();
    if (!q) {
      this.carregarMinhas();
      return;
    }
    if (!/^\d+$/.test(q)) {
      this.erro.set('Informe apenas o número da solicitação.');
      return;
    }

    this.carregando.set(true);
    this.erro.set('');
    this.modoBusca.set(true);
    this.filialFiltro.set(null);
    this.buscaNumero.set(q);
    this.contexto.set(`Resultado da busca pela solicitação nº ${q}`);

    this.followup.porNumero(q).subscribe({
      next: (rows) => {
        this.solicitacoes.set(rows);
        this.carregando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.solicitacoes.set([]);
        if (err.status === 404 || err.status === 403) {
          this.erro.set('');
        } else {
          this.erro.set(err.error?.mensagem || 'Erro na busca.');
        }
        this.carregando.set(false);
      },
    });
  }

  limparBusca(): void {
    this.carregarMinhas();
  }

  trackSolicitacao(r: FollowupSolicitacao): string {
    return `${r.n_requisicao}|${r.cod_filial || ''}|${r.id}`;
  }

  cardTone(r: FollowupSolicitacao): CardTone {
    return familiaToTone(r.familia);
  }

  msgView(r: FollowupSolicitacao): MsgView {
    return parseMensagem(r);
  }

  dataEmissaoLabel(r: FollowupSolicitacao): string {
    return fmtDataBr(r.data_emissao_pedido) || '—';
  }

  formatMoeda(v: number | null | undefined): string {
    return fmtMoeda(v);
  }
}
