import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { LoginBrandPanelComponent } from './login-brand-panel.component';
import { AuthService } from '../../services/auth.service';
import { MsalConfigService } from '../../services/msal-config.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, LoginBrandPanelComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);
  readonly msalConfig = inject(MsalConfigService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    senha: ['', Validators.required],
    manterConectado: [true],
  });

  mostrarSenha = false;
  mostrarLoginLocal = false;
  autenticando = signal(false);
  mensagemErro = signal('');
  avisoMsal = signal('');
  sessaoExpirada = signal(false);

  ngOnInit(): void {
    if (this.auth.estaLogado()) {
      void this.router.navigate(['/inicio']);
      return;
    }

    this.route.queryParams.subscribe((params) => {
      this.sessaoExpirada.set(params['reason'] === 'idle');
    });

    const msalErr = this.msalConfig.getLoadError();
    if (msalErr) {
      this.avisoMsal.set(msalErr);
    }

    this.auth.handleRedirect().subscribe({
      error: (err: HttpErrorResponse) => {
        this.mensagemErro.set(err.error?.mensagem || 'Falha no login Microsoft.');
      },
    });
  }

  enviarLogin(): void {
    if (this.autenticando()) return;

    const { email, senha, manterConectado } = this.form.getRawValue();
    if (!email.trim() || !senha.trim()) {
      this.mensagemErro.set('Preencha e-mail e senha para continuar.');
      return;
    }

    this.mensagemErro.set('');
    this.autenticando.set(true);

    this.auth.loginLocal(email.trim(), senha, manterConectado).subscribe({
      next: () => {
        void this.router.navigate(['/inicio']).then((ok) => {
          if (!ok) {
            this.mensagemErro.set('Não foi possível abrir a página inicial.');
          }
          this.autenticando.set(false);
        });
      },
      error: (err: unknown) => {
        const http = err as HttpErrorResponse;
        const msg =
          http.error?.mensagem ||
          (err instanceof Error ? err.message : null) ||
          'Credenciais inválidas.';
        this.mensagemErro.set(msg);
        this.autenticando.set(false);
      },
    });
  }

  async entrarMicrosoft(): Promise<void> {
    if (this.autenticando() || this.auth.msalBusy()) return;
    this.mensagemErro.set('');
    try {
      await this.auth.loginMicrosoft();
    } catch (err) {
      this.mensagemErro.set(err instanceof Error ? err.message : 'Erro ao iniciar login Microsoft.');
    }
  }

  alternarSenha(): void {
    this.mostrarSenha = !this.mostrarSenha;
  }

  toggleLoginLocal(): void {
    this.mostrarLoginLocal = !this.mostrarLoginLocal;
  }

  onSenhaEnter(event: Event): void {
    event.preventDefault();
    this.enviarLogin();
  }
}
