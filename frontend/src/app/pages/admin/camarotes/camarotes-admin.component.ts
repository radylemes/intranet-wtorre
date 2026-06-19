import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AlertasService } from '../../../services/alertas.service';
import { CamarotesService } from '../../../services/camarotes.service';
import {
  CamarotesConfig,
  CamarotesDashboard,
  CamarotesSyncLog,
} from '../../../models/camarote.model';

@Component({
  selector: 'app-camarotes-admin',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe],
  templateUrl: './camarotes-admin.component.html',
  styleUrl: './camarotes-admin.component.scss',
})
export class CamarotesAdminComponent implements OnInit {
  private readonly camarotesService = inject(CamarotesService);
  private readonly alertas = inject(AlertasService);

  readonly dashboard = signal<CamarotesDashboard | null>(null);
  readonly config = signal<CamarotesConfig | null>(null);
  readonly syncLogs = signal<CamarotesSyncLog[]>([]);
  readonly carregando = signal(false);
  readonly sincronizando = signal(false);
  readonly salvandoConfig = signal(false);
  readonly enviando = signal(false);
  readonly mensagem = signal('');
  readonly erro = signal('');

  readonly emailsTexto = signal('');
  readonly diasVenceBreve = signal(90);
  readonly cadencia = signal<'diaria' | 'semanal'>('diaria');
  readonly envioAtivo = signal(true);

  readonly setores = ['Oeste', 'Norte', 'Leste', 'Sul'];

  readonly ultimaSyncLabel = computed(() => {
    const d = this.dashboard()?.ultima_sync;
    return d ? new Date(d).toLocaleString('pt-BR') : 'Nunca sincronizado';
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
  }

  carregarTudo(): void {
    this.carregando.set(true);
    this.camarotesService.dashboard().subscribe({
      next: (d) => this.dashboard.set(d),
      error: (err: HttpErrorResponse) =>
        this.erro.set(err.error?.mensagem || 'Erro ao carregar dashboard.'),
    });
    this.camarotesService.obterConfig().subscribe({
      next: (c) => {
        this.config.set(c);
        this.emailsTexto.set((c.emails_alerta || []).join('\n'));
        this.diasVenceBreve.set(c.dias_vence_breve);
        this.cadencia.set(c.cadencia);
        this.envioAtivo.set(c.envio_ativo);
      },
      error: () => {},
    });
    this.camarotesService.syncLog().subscribe({
      next: (logs) => this.syncLogs.set(logs),
      error: () => {},
      complete: () => this.carregando.set(false),
    });
  }

  moeda(valor: number | null | undefined): string {
    if (valor == null) return '—';
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
    const emails = this.emailsTexto()
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter(Boolean);

    this.salvandoConfig.set(true);
    this.camarotesService
      .salvarConfig({
        emails_alerta: emails,
        dias_vence_breve: this.diasVenceBreve(),
        cadencia: this.cadencia(),
        envio_ativo: this.envioAtivo(),
      })
      .subscribe({
        next: (c) => {
          this.config.set(c);
          this.mensagem.set('Configuração salva.');
          this.salvandoConfig.set(false);
          this.carregarTudo();
        },
        error: (err: HttpErrorResponse) => {
          this.erro.set(err.error?.mensagem || 'Erro ao salvar configuração.');
          this.salvandoConfig.set(false);
        },
      });
  }

  previewResumo(): void {
    this.enviando.set(true);
    this.camarotesService.enviarResumo(true).subscribe({
      next: (res) => {
        this.enviando.set(false);
        if (res.html) {
          const w = window.open('', '_blank');
          if (w) {
            w.document.write(res.html);
            w.document.close();
          }
        } else {
          this.alertas.sucesso(res.motivo || 'Nada a exibir.');
        }
      },
      error: (err: HttpErrorResponse) => {
        this.erro.set(err.error?.mensagem || 'Erro ao gerar pré-visualização.');
        this.enviando.set(false);
      },
    });
  }

  async enviarResumo(): Promise<void> {
    const ok = await this.alertas.confirmar({
      titulo: 'Enviar resumo',
      texto: 'Enviar digest de alertas para os e-mails configurados?',
      confirmar: 'Enviar',
    });
    if (!ok) return;

    this.enviando.set(true);
    this.camarotesService.enviarResumo(false).subscribe({
      next: (res) => {
        this.enviando.set(false);
        if (res.enviado) {
          this.mensagem.set(`Resumo enviado para ${res.enviados} destinatário(s).`);
        } else {
          this.alertas.sucesso(res.motivo || 'Nenhum envio realizado.');
        }
        this.carregarTudo();
      },
      error: (err: HttpErrorResponse) => {
        this.erro.set(err.error?.mensagem || 'Erro ao enviar resumo.');
        this.enviando.set(false);
      },
    });
  }

  numerosSetor(dashboard: CamarotesDashboard, setor: string): string {
    const bloco = dashboard.camarotes.disponiveis_por_setor?.[setor];
    if (!bloco?.numeros?.length) return '—';
    return bloco.numeros.join(', ');
  }

  totalSetor(dashboard: CamarotesDashboard, setor: string): number {
    return dashboard.camarotes.disponiveis_por_setor?.[setor]?.total ?? 0;
  }

  tiposCessionarioKeys(obj: Record<string, unknown> | undefined): string[] {
    return obj ? Object.keys(obj) : [];
  }

  andaresEntries(porAndar: Record<string, Record<string, number>> | undefined): Array<{ andar: string; tipos: Array<{ nome: string; qtd: number }> }> {
    if (!porAndar) return [];
    return Object.entries(porAndar).map(([andar, tipos]) => ({
      andar,
      tipos: Object.entries(tipos).map(([nome, qtd]) => ({ nome, qtd })),
    }));
  }
}
