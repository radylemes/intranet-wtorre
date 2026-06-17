import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfiguracoesService } from '../../../services/configuracoes.service';
import { PAGINAS_INTERNAS } from '../../../data/paginas-internas';
import { AdminToastService } from '../../../shared/admin/admin-toast/admin-toast.service';

@Component({
  selector: 'app-configuracoes-admin',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './configuracoes-admin.component.html',
  styleUrl: './configuracoes-admin.component.scss',
})
export class ConfiguracoesAdminComponent implements OnInit {
  private readonly api = inject(ConfiguracoesService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(AdminToastService);

  readonly paginasInternas = PAGINAS_INTERNAS;
  readonly mensagem = signal('');
  readonly erro = signal('');
  readonly salvando = signal(false);
  readonly carregando = signal(true);

  readonly form = this.fb.nonNullable.group({
    label: ['Abrir Chamado', Validators.required],
    tipo_destino: ['interna' as 'interna' | 'externa'],
    pagina_interna: [''],
    url_externa: [''],
    ativo: [false],
    abrir_nova_aba: [true],
  });

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
    this.api.getAdmin().subscribe({
      next: ({ header_chamado: c }) => {
        const isInterna = c.tipo_destino === 'interna';
        this.form.patchValue({
          label: c.label,
          tipo_destino: c.tipo_destino,
          pagina_interna: isInterna && c.url ? c.url : '',
          url_externa: !isInterna && c.url ? c.url : '',
          ativo: c.ativo,
          abrir_nova_aba: c.abrir_nova_aba,
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
}
