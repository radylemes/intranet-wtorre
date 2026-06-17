import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of, throwError, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { LoginResposta, Usuario } from '../models/usuario.model';
import { MsalConfigService } from './msal-config.service';
import { ADMIN_MODULO_ROTAS } from '../data/admin-modulos';

const CHAVE_ACCESS = 'intranet_wtorre_access';
const CHAVE_REFRESH = 'intranet_wtorre_refresh';
const CHAVE_USUARIO = 'intranet_wtorre_usuario';
const CHAVE_REDIRECT_FP = 'intranet_msal_redirect_fp';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly msalConfig = inject(MsalConfigService);

  private accessMemoria: string | null = null;
  private refreshMemoria: string | null = null;
  readonly usuario = signal<Usuario | null>(null);
  readonly modulos = signal<string[]>([]);
  readonly msalBusy = signal(false);

  constructor() {
    this.restaurarSessao();
  }

  private api(path: string): string {
    return `${environment.apiBaseUrl}${path}`;
  }

  private mapUsuario(u: Usuario): Usuario {
    const mapped = { ...u, nome: u.nome_completo };
    this.modulos.set(u.modulos ?? []);
    return mapped;
  }

  loginLocal(email: string, senha: string, manterConectado = true): Observable<LoginResposta> {
    return this.http
      .post<LoginResposta>(this.api('/auth/login'), { email, senha })
      .pipe(tap((res) => this.persistirSessao(res, manterConectado)));
  }

  /** @deprecated use loginLocal */
  login(usuario: string, senha: string, manterConectado = true): Observable<LoginResposta> {
    return this.loginLocal(usuario, senha, manterConectado);
  }

  async loginMicrosoft(): Promise<void> {
    if (!this.msalConfig.hasClientId()) {
      throw new Error(this.msalConfig.getLoadError() || 'Microsoft SSO não configurado.');
    }
    const instance = this.msalConfig.getInstance();
    if (!instance) throw new Error('MSAL não inicializado.');

    this.msalBusy.set(true);
    try {
      await instance.loginRedirect({
        scopes: ['User.Read', 'openid', 'profile'],
        prompt: 'select_account',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('interaction_in_progress')) {
        sessionStorage.removeItem('msal.interaction.status');
        await instance.loginRedirect({
          scopes: ['User.Read', 'openid', 'profile'],
          prompt: 'select_account',
        });
      } else {
        throw err;
      }
    } finally {
      this.msalBusy.set(false);
    }
  }

  handleRedirect(): Observable<LoginResposta | null> {
    const result = this.msalConfig.consumeRedirectResult();
    if (!result?.idToken) return of(null);

    const fp = result.idToken.slice(0, 32);
    if (sessionStorage.getItem(CHAVE_REDIRECT_FP) === fp) {
      return of(null);
    }
    sessionStorage.setItem(CHAVE_REDIRECT_FP, fp);

    if (typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    return this.http.post<LoginResposta>(
      this.api('/auth/login-microsoft'),
      {},
      { headers: new HttpHeaders({ Authorization: `Bearer ${result.idToken}` }) }
    ).pipe(
      tap((res) => this.persistirSessao(res, true)),
      catchError((err) => {
        sessionStorage.removeItem(CHAVE_REDIRECT_FP);
        return throwError(() => err);
      })
    );
  }

  irParaInicio(): void {
    if (!this.estaLogado()) return;

    void this.router.navigateByUrl('/inicio', { replaceUrl: true }).then((ok) => {
      if (!ok && typeof window !== 'undefined') {
        window.location.assign('/inicio');
      }
    });
  }

  refresh(): Observable<{ accessToken: string; token: string } | null> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return of(null);
    return this.http.post<{ accessToken: string; token: string }>(this.api('/auth/refresh'), {
      refreshToken,
    }).pipe(
      tap((res) => {
        this.accessMemoria = res.accessToken;
        localStorage.setItem(CHAVE_ACCESS, res.accessToken);
        sessionStorage.setItem(CHAVE_ACCESS, res.accessToken);
      }),
      catchError(() => {
        this.logout(false);
        return of(null);
      })
    );
  }

  logout(navigate = true, msalLogout = true): void {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      this.http.post(this.api('/auth/logout'), { refreshToken }).subscribe();
    }

    const instance = this.msalConfig.getInstance();
    if (instance) {
      const accounts = instance.getAllAccounts();
      if (msalLogout && accounts.length) {
        void instance.logoutRedirect({ account: accounts[0] }).catch(() => {
          instance.clearCache();
        });
      } else {
        instance.clearCache();
      }
    }

    this.accessMemoria = null;
    this.refreshMemoria = null;
    this.usuario.set(null);
    this.modulos.set([]);
    localStorage.removeItem(CHAVE_ACCESS);
    localStorage.removeItem(CHAVE_REFRESH);
    localStorage.removeItem(CHAVE_USUARIO);
    sessionStorage.removeItem(CHAVE_ACCESS);
    sessionStorage.removeItem(CHAVE_REFRESH);
    sessionStorage.removeItem(CHAVE_USUARIO);
    sessionStorage.removeItem(CHAVE_REDIRECT_FP);

    if (navigate) {
      void this.router.navigate(['/login']);
    }
  }

  estaLogado(): boolean {
    return !!this.getToken();
  }

  getToken(): string | null {
    if (this.accessMemoria) return this.accessMemoria;
    return localStorage.getItem(CHAVE_ACCESS) ?? sessionStorage.getItem(CHAVE_ACCESS);
  }

  getRefreshToken(): string | null {
    if (this.refreshMemoria) return this.refreshMemoria;
    return localStorage.getItem(CHAVE_REFRESH) ?? sessionStorage.getItem(CHAVE_REFRESH);
  }

  carregarPerfil(): Observable<Usuario | null> {
    if (!this.estaLogado()) return of(null);
    return this.http.get<Usuario>(this.api('/auth/me')).pipe(
      tap((u) => {
        const mapped = this.mapUsuario(u);
        this.usuario.set(mapped);
        const storage =
          localStorage.getItem(CHAVE_ACCESS) != null ? localStorage : sessionStorage;
        storage.setItem(CHAVE_USUARIO, JSON.stringify({ ...mapped, modulos: this.modulos() }));
      }),
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401) {
          this.logout(true, false);
        }
        return of(null);
      })
    );
  }

  getProfilePhotoUrl(): string {
    return this.api('/auth/profile-photo');
  }

  getPrimeiroNome(): string {
    const nome = this.usuario()?.nome_completo ?? this.usuario()?.nome ?? '';
    return nome.split(' ')[0] || 'Colaborador';
  }

  getIniciais(): string {
    const nome = this.usuario()?.nome_completo ?? this.usuario()?.nome ?? '';
    const partes = nome.trim().split(/\s+/);
    if (partes.length >= 2) {
      return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
    }
    return nome.slice(0, 2).toUpperCase() || '??';
  }

  isAdmin(): boolean {
    return this.usuario()?.perfil === 'ADMIN';
  }

  hasModulo(codigo: string): boolean {
    return this.isAdmin() || this.modulos().includes(codigo);
  }

  temAcessoAdmin(): boolean {
    return this.isAdmin() || this.modulos().length > 0;
  }

  primeiraRotaAdmin(): string | null {
    if (this.isAdmin()) {
      return 'menu';
    }
    const mods = this.modulos();
    for (const { codigo, rota } of ADMIN_MODULO_ROTAS) {
      if (mods.includes(codigo)) {
        return rota;
      }
    }
    return null;
  }

  private persistirSessao(res: LoginResposta, manterConectado: boolean): void {
    const raw = res.usuario ?? res.user;
    if (!raw) {
      throw new Error('Resposta de login sem dados do utilizador.');
    }
    const user = this.mapUsuario(raw);
    this.accessMemoria = res.accessToken;
    this.refreshMemoria = res.refreshToken;
    this.usuario.set(user);

    const storage = manterConectado ? localStorage : sessionStorage;
    storage.setItem(CHAVE_ACCESS, res.accessToken);
    storage.setItem(CHAVE_REFRESH, res.refreshToken);
    storage.setItem(CHAVE_USUARIO, JSON.stringify({ ...user, modulos: this.modulos() }));

    const other = manterConectado ? sessionStorage : localStorage;
    other.removeItem(CHAVE_ACCESS);
    other.removeItem(CHAVE_REFRESH);
    other.removeItem(CHAVE_USUARIO);
  }

  private restaurarSessao(): void {
    const access =
      localStorage.getItem(CHAVE_ACCESS) ?? sessionStorage.getItem(CHAVE_ACCESS);
    const refresh =
      localStorage.getItem(CHAVE_REFRESH) ?? sessionStorage.getItem(CHAVE_REFRESH);
    const usuarioJson =
      localStorage.getItem(CHAVE_USUARIO) ?? sessionStorage.getItem(CHAVE_USUARIO);

    if (access) this.accessMemoria = access;
    if (refresh) this.refreshMemoria = refresh;
    if (usuarioJson) {
      try {
        const u = JSON.parse(usuarioJson) as Usuario;
        this.usuario.set(this.mapUsuario(u));
        if (access && (!u.modulos || u.modulos.length === 0) && u.perfil !== 'ADMIN') {
          void firstValueFrom(this.carregarPerfil()).catch(() => null);
        }
      } catch {
        /* ignora */
      }
    } else if (access) {
      void firstValueFrom(this.carregarPerfil()).catch(() => null);
    }
  }
}

export function authMsalRedirectInitializer(auth: AuthService) {
  return () =>
    firstValueFrom(auth.handleRedirect())
      .then((res) => {
        if (res) auth.irParaInicio();
        return res;
      })
      .catch(() => null);
}
