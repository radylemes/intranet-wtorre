import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ConfiguracoesAdmin, HeaderChamadoConfig } from '../models/configuracoes.model';

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
}
