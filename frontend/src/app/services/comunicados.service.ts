import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Comunicado, ComunicadoAdmin, ComunicadoPayload } from '../models/comunicado.model';

@Injectable({ providedIn: 'root' })
export class ComunicadosService {
  private readonly http = inject(HttpClient);

  private api(path: string): string {
    return `${environment.apiBaseUrl}${path}`;
  }

  listar(): Observable<Comunicado[]> {
    return this.http.get<Comunicado[]>(this.api('/comunicados'));
  }

  listarAdmin(busca?: string): Observable<ComunicadoAdmin[]> {
    const params = busca?.trim() ? { busca: busca.trim() } : undefined;
    return this.http.get<ComunicadoAdmin[]>(this.api('/comunicados/admin'), { params });
  }

  obter(id: number): Observable<ComunicadoAdmin> {
    return this.http.get<ComunicadoAdmin>(this.api(`/comunicados/${id}`));
  }

  criar(payload: ComunicadoPayload): Observable<ComunicadoAdmin> {
    return this.http.post<ComunicadoAdmin>(this.api('/comunicados'), this.toBody(payload));
  }

  atualizar(id: number, payload: ComunicadoPayload): Observable<ComunicadoAdmin> {
    return this.http.put<ComunicadoAdmin>(this.api(`/comunicados/${id}`), this.toBody(payload));
  }

  remover(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(this.api(`/comunicados/${id}`));
  }

  private toBody(payload: ComunicadoPayload): Record<string, unknown> {
    return {
      titulo: payload.titulo,
      categoria: payload.categoria,
      data_publicacao: payload.dataPublicacao,
      ordem: payload.ordem ?? null,
      ativo: payload.ativo ?? true,
    };
  }
}
