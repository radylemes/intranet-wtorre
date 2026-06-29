import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, catchError, firstValueFrom, map, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AniversariantesResposta,
  Colaborador,
  ColaboradorAdmin,
  ColaboradoresAdminFiltros,
  ColaboradoresAdminResposta,
  ColaboradoresStats,
  ColaboradoresSyncResumo,
  DiretorioResposta,
} from '../models/colaborador.model';

@Injectable({ providedIn: 'root' })
export class ColaboradoresService {
  private readonly http = inject(HttpClient);
  private cache: DiretorioResposta | null = null;
  private readonly cache$ = new BehaviorSubject<DiretorioResposta | null>(null);

  private api(path: string): string {
    return `${environment.apiBaseUrl}${path}`;
  }

  getDiretorio(force = false): Observable<DiretorioResposta> {
    if (this.cache && !force) {
      return new Observable((sub) => {
        sub.next(this.cache!);
        sub.complete();
      });
    }
    return this.http.get<DiretorioResposta>(this.api('/colaboradores')).pipe(
      tap((res) => {
        this.cache = res;
        this.cache$.next(res);
      })
    );
  }

  getDepartamentos(): Observable<string[]> {
    return this.http.get<string[]>(this.api('/colaboradores/departamentos'));
  }

  getAniversariantes(mes: number): Observable<AniversariantesResposta> {
    return this.http.get<AniversariantesResposta>(this.api('/aniversariantes'), {
      params: { mes: String(mes) },
    });
  }

  carregarFotoBlob(id: number): Observable<Blob | null> {
    return this.http
      .get(this.api(`/colaboradores/${id}/foto`), { responseType: 'blob', observe: 'response' })
      .pipe(
        map((res: HttpResponse<Blob>) =>
          res.status === 200 && res.body?.size ? res.body : null
        ),
        catchError(() => of(null))
      );
  }

  async fotoObjectUrl(id: number): Promise<string | null> {
    try {
      const blob = await firstValueFrom(this.carregarFotoBlob(id));
      if (!blob?.size) return null;
      const normalized = blob.type.startsWith('image/') ? blob : new Blob([blob], { type: 'image/jpeg' });
      return URL.createObjectURL(normalized);
    } catch {
      return null;
    }
  }

  sincronizar(): Observable<ColaboradoresSyncResumo> {
    return this.http.post<ColaboradoresSyncResumo>(this.api('/colaboradores/sync'), {}).pipe(
      tap(() => this.invalidarCache())
    );
  }

  listarAdmin(filtros: ColaboradoresAdminFiltros = {}): Observable<ColaboradoresAdminResposta> {
    const params: Record<string, string> = {};
    if (filtros.busca?.trim()) params['busca'] = filtros.busca.trim();
    if (filtros.empresa?.trim()) params['empresa'] = filtros.empresa.trim();
    if (filtros.departamento?.trim()) params['departamento'] = filtros.departamento.trim();
    if (filtros.ativo) params['ativo'] = filtros.ativo;
    if (filtros.page) params['page'] = String(filtros.page);
    if (filtros.limit) params['limit'] = String(filtros.limit);
    return this.http.get<ColaboradoresAdminResposta>(this.api('/colaboradores/admin'), { params });
  }

  obterAdmin(id: number): Observable<ColaboradorAdmin> {
    return this.http.get<ColaboradorAdmin>(this.api(`/colaboradores/admin/${id}`));
  }

  obterStats(): Observable<ColaboradoresStats> {
    return this.http.get<ColaboradoresStats>(this.api('/colaboradores/admin/stats'));
  }

  invalidarCache(): void {
    this.cache = null;
    this.cache$.next(null);
  }
}
