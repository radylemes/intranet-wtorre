import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { EventosAgendaResponse, EventosProximosResponse } from '../models/evento.model';

@Injectable({ providedIn: 'root' })
export class EventosService {
  private readonly http = inject(HttpClient);

  listarProximos(): Observable<EventosProximosResponse> {
    return this.http.get<EventosProximosResponse>(`${environment.apiBaseUrl}/eventos/proximos`);
  }

  listarAgenda(limite?: number): Observable<EventosAgendaResponse> {
    let params = new HttpParams();
    if (limite != null && Number.isFinite(limite)) {
      params = params.set('limite', String(limite));
    }
    return this.http.get<EventosAgendaResponse>(`${environment.apiBaseUrl}/eventos/agenda`, {
      params,
    });
  }
}
