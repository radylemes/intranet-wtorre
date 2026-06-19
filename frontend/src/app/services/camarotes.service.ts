import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CamaroteUnidade,
  CamarotesConfig,
  CamarotesDashboard,
  CamarotesSyncLog,
  EnviarResumoResposta,
  SituacaoUnidade,
  SyncResumo,
  TipoUnidade,
} from '../models/camarote.model';

@Injectable({ providedIn: 'root' })
export class CamarotesService {
  private readonly http = inject(HttpClient);

  private api(path: string): string {
    return `${environment.apiBaseUrl}${path}`;
  }

  dashboard(): Observable<CamarotesDashboard> {
    return this.http.get<CamarotesDashboard>(this.api('/camarotes/dashboard'));
  }

  unidades(filtros?: {
    tipo?: TipoUnidade;
    setor?: string;
    situacao?: SituacaoUnidade;
  }): Observable<CamaroteUnidade[]> {
    let params = new HttpParams();
    if (filtros?.tipo) params = params.set('tipo', filtros.tipo);
    if (filtros?.setor) params = params.set('setor', filtros.setor);
    if (filtros?.situacao) params = params.set('situacao', filtros.situacao);
    return this.http.get<CamaroteUnidade[]>(this.api('/camarotes/unidades'), { params });
  }

  obterConfig(): Observable<CamarotesConfig> {
    return this.http.get<CamarotesConfig>(this.api('/camarotes/config'));
  }

  salvarConfig(config: Partial<CamarotesConfig>): Observable<CamarotesConfig> {
    return this.http.put<CamarotesConfig>(this.api('/camarotes/config'), config);
  }

  sincronizar(): Observable<SyncResumo> {
    return this.http.post<SyncResumo>(this.api('/camarotes/sincronizar'), {});
  }

  syncLog(limit = 20): Observable<CamarotesSyncLog[]> {
    return this.http.get<CamarotesSyncLog[]>(this.api('/camarotes/sync-log'), {
      params: { limit: String(limit) },
    });
  }

  enviarResumo(preview = false): Observable<EnviarResumoResposta> {
    const params = preview ? new HttpParams().set('preview', '1') : undefined;
    return this.http.post<EnviarResumoResposta>(this.api('/camarotes/enviar-resumo'), {}, { params });
  }
}
