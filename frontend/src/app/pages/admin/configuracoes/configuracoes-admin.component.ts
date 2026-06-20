import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { ConfiguracoesService } from '../../../services/configuracoes.service';
import { DocumentosService } from '../../../services/documentos.service';
import { PaginaInterna, buildPaginasInternasLista } from '../../../data/paginas-internas';
import { AlertasService } from '../../../services/alertas.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-configuracoes-admin',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './configuracoes-admin.component.html',
  styleUrl: './configuracoes-admin.component.scss',
})
export class ConfiguracoesAdminComponent implements OnInit {
  private readonly api = inject(ConfiguracoesService);
  private readonly documentosService = inject(DocumentosService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly alertas = inject(AlertasService);

  readonly paginasInternas = signal<PaginaInterna[]>(buildPaginasInternasLista());
  readonly mensagem = signal('');
  readonly erro = signal('');
  readonly salvando = signal(false);
  readonly salvandoSmtp = signal(false);
  readonly verificandoSmtp = signal(false);
  readonly enviandoTesteSmtp = signal(false);
  readonly carregando = signal(true);
  readonly smtpHasPassword = signal(false);
  readonly mostrarSenhaSmtp = signal(false);

  readonly form = this.fb.nonNullable.group({
    label: ['Abrir Chamado', Validators.required],
    tipo_destino: ['interna' as 'interna' | 'externa'],
    pagina_interna: [''],
    url_externa: [''],
    ativo: [false],
    abrir_nova_aba: [true],
  });

  readonly smtpForm = this.fb.nonNullable.group({
    host: [''],
    port: [587, [Validators.required, Validators.min(1), Validators.max(65535)]],
    secure: [false],
    user: [''],
    password: [''],
    from_email: [''],
    from_name: [''],
    ativo: [false],
    destinatario_teste: [''],
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
    this.documentosService.listarCategorias().subscribe({
      next: (categorias) => this.paginasInternas.set(buildPaginasInternasLista(categorias)),
      error: () => this.paginasInternas.set(buildPaginasInternasLista()),
    });

    forkJoin({
      admin: this.api.getAdmin(),
      smtp: this.api.getSmtp(),
    }).subscribe({
      next: ({ admin, smtp }) => {
        const c = admin.header_chamado;
        const isInterna = c.tipo_destino === 'interna';
        this.form.patchValue({
          label: c.label,
          tipo_destino: c.tipo_destino,
          pagina_interna: isInterna && c.url ? c.url : '',
          url_externa: !isInterna && c.url ? c.url : '',
          ativo: c.ativo,
          abrir_nova_aba: c.abrir_nova_aba,
        });

        this.smtpHasPassword.set(smtp.has_password);
        this.smtpForm.patchValue({
          host: smtp.host,
          port: smtp.port,
          secure: smtp.secure,
          user: smtp.user,
          password: '',
          from_email: smtp.from_email,
          from_name: smtp.from_name,
          ativo: smtp.ativo,
          destinatario_teste: this.auth.usuario()?.email || '',
        });

        this.carregando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.erro.set(err.error?.mensagem || 'Erro ao carregar configurações.');
        this.carregando.set(false);
      },
    });
  }

  salvar(): void {
    if (this.form.invalid) return;

    const raw = this.form.getRawValue();
    const tipo = raw.tipo_destino;
    const url =
      tipo === 'interna' ? raw.pagina_interna.trim() : raw.url_externa.trim() || null;

    if (raw.ativo && !url) {
      this.erro.set('Informe o destino antes de ativar o botão.');
      return;
    }

    this.salvando.set(true);
    this.erro.set('');

    this.api
      .salvarHeaderChamado({
        label: raw.label.trim(),
        url: url || null,
        ativo: raw.ativo,
        abrir_nova_aba: raw.abrir_nova_aba,
        tipo_destino: tipo,
      })
      .subscribe({
        next: () => {
          this.mensagem.set('Configurações salvas.');
          this.salvando.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.erro.set(err.error?.mensagem || 'Erro ao salvar.');
          this.salvando.set(false);
        },
      });
  }

  salvarSmtp(): void {
    if (this.smtpForm.invalid) return;

    const raw = this.smtpForm.getRawValue();
    this.salvandoSmtp.set(true);
    this.erro.set('');

    this.api
      .salvarSmtp({
        host: raw.host.trim(),
        port: Number(raw.port),
        secure: raw.secure,
        user: raw.user.trim(),
        password: raw.password.trim() || undefined,
        from_email: raw.from_email.trim(),
        from_name: raw.from_name.trim(),
        ativo: raw.ativo,
      })
      .subscribe({
        next: (smtp) => {
          this.smtpHasPassword.set(smtp.has_password);
          this.smtpForm.patchValue({ password: '' });
          this.mostrarSenhaSmtp.set(false);
          this.mensagem.set('Configurações SMTP salvas.');
          this.salvandoSmtp.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.erro.set(err.error?.mensagem || 'Erro ao salvar SMTP.');
          this.salvandoSmtp.set(false);
        },
      });
  }

  verificarSmtp(): void {
    this.verificandoSmtp.set(true);
    this.erro.set('');

    this.api.verificarSmtp().subscribe({
      next: (res) => {
        this.mensagem.set(res.mensagem || 'Conexão SMTP verificada com sucesso.');
        this.verificandoSmtp.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.erro.set(err.error?.mensagem || 'Falha ao verificar conexão SMTP.');
        this.verificandoSmtp.set(false);
      },
    });
  }

  enviarTesteSmtp(): void {
    const destinatario = this.smtpForm.controls.destinatario_teste.value.trim();
    this.enviandoTesteSmtp.set(true);
    this.erro.set('');

    this.api.enviarTesteSmtp(destinatario || undefined).subscribe({
      next: (res) => {
        this.mensagem.set(res.mensagem || 'E-mail de teste enviado.');
        this.enviandoTesteSmtp.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.erro.set(err.error?.mensagem || 'Falha ao enviar e-mail de teste.');
        this.enviandoTesteSmtp.set(false);
      },
    });
  }

  toggleSenhaSmtp(): void {
    this.mostrarSenhaSmtp.update((v) => !v);
  }
}
