import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ConfiguracoesAdmin, HeaderChamadoConfig, SmtpConfig } from '../models/configuracoes.model';

@Injectable({ providedIn: 'root' })
export class ConfiguracoesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/configuracoes`;

  getHeaderChamado(): Observable<HeaderChamadoConfig> {
    return this.http.get<HeaderChamadoConfig>(`${this.base}/header-chamado`);
  }

  getAdmin(): Observable<ConfiguracoesAdmin> {
    return this.http.get<ConfiguracoesAdmin>(this.base);
  }

  salvarHeaderChamado(body: {
    label: string;
    url: string | null;
    ativo: boolean;
    abrir_nova_aba: boolean;
    tipo_destino: 'interna' | 'externa';
  }): Observable<HeaderChamadoConfig> {
    return this.http.put<HeaderChamadoConfig>(`${this.base}/header-chamado`, body);
  }

  getSmtp(): Observable<SmtpConfig> {
    return this.http.get<SmtpConfig>(`${this.base}/smtp`);
  }

  salvarSmtp(body: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password?: string;
    from_email: string;
    from_name: string;
    ativo: boolean;
  }): Observable<SmtpConfig> {
    return this.http.put<SmtpConfig>(`${this.base}/smtp`, body);
  }

  verificarSmtp(): Observable<{ ok: boolean; mensagem: string }> {
    return this.http.post<{ ok: boolean; mensagem: string }>(`${this.base}/smtp/verificar`, {});
  }

  enviarTesteSmtp(destinatario?: string): Observable<{ ok: boolean; mensagem: string }> {
    return this.http.post<{ ok: boolean; mensagem: string }>(`${this.base}/smtp/teste`, {
      destinatario,
    });
  }
}
