import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { AlertasService } from '../../../services/alertas.service';
import { CamarotesService } from '../../../services/camarotes.service';
import { PerfisAcessoService } from '../../../services/perfis-acesso.service';
import {
  CamarotesConfig,
  CamarotesSyncLog,
  CamarotesVisualizador,
} from '../../../models/camarote.model';
import { ColaboradorBusca } from '../../../models/perfil-acesso.model';

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
  private readonly alertas = inject(AlertasService);
  private readonly busca$ = new Subject<string>();

  readonly config = signal<CamarotesConfig | null>(null);
  readonly syncLogs = signal<CamarotesSyncLog[]>([]);
  readonly visualizadores = signal<CamarotesVisualizador[]>([]);
  readonly resultadosBusca = signal<ColaboradorBusca[]>([]);
  readonly buscaTexto = signal('');
  readonly carregando = signal(false);
  readonly sincronizando = signal(false);
  readonly salvandoConfig = signal(false);
  readonly enviando = signal(false);
  readonly adicionandoVisualizador = signal(false);
  readonly mensagem = signal('');
  readonly erro = signal('');

  readonly emailsTexto = signal('');
  readonly diasVenceBreve = signal(90);
  readonly cadencia = signal<'diaria' | 'semanal'>('diaria');
  readonly envioAtivo = signal(true);
  readonly syncAutomatica = signal(true);
  readonly syncFrequencia = signal<'1h' | '6h' | '12h' | '24h' | 'semanal'>('24h');

  readonly ultimaSyncLabel = computed(() => {
    const d = this.config()?.ultima_sync;
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
  }

  carregarTudo(): void {
    this.carregando.set(true);
    this.camarotesService.obterConfig().subscribe({
      next: (c) => {
        this.config.set(c);
        this.emailsTexto.set((c.emails_alerta || []).join('\n'));
        this.diasVenceBreve.set(c.dias_vence_breve);
        this.cadencia.set(c.cadencia);
        this.envioAtivo.set(c.envio_ativo);
        this.syncAutomatica.set(c.sync_automatica ?? true);
        this.syncFrequencia.set(c.sync_frequencia ?? '24h');
      },
      error: (err: HttpErrorResponse) =>
        this.erro.set(err.error?.mensagem || 'Erro ao carregar configuração.'),
    });
    this.camarotesService.syncLog().subscribe({
      next: (logs) => this.syncLogs.set(logs),
      error: (err: HttpErrorResponse) =>
        this.erro.set(err.error?.mensagem || 'Erro ao carregar histórico de sincronizações.'),
    });
    this.camarotesService.listarVisualizadores().subscribe({
      next: (lista) => this.visualizadores.set(lista),
      error: (err: HttpErrorResponse) =>
        this.erro.set(err.error?.mensagem || 'Erro ao carregar visualizadores.'),
      complete: () => this.carregando.set(false),
    });
  }

  onBuscaInput(valor: string): void {
    this.buscaTexto.set(valor);
    this.busca$.next(valor);
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
        sync_automatica: this.syncAutomatica(),
        sync_frequencia: this.syncFrequencia(),
      })
      .subscribe({
        next: (c) => {
          this.config.set(c);
          this.mensagem.set('Configuração salva.');
          this.salvandoConfig.set(false);
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
}
