import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, tap, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { MenuItem, MenuItemPayload, MenuReorderItem } from '../models/menu.model';
import { navDataToMenuTree } from '../data/nav.data';

@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly http = inject(HttpClient);
  private cache: MenuItem[] | null = null;
  private readonly menuSubject = new BehaviorSubject<MenuItem[]>([]);
  readonly menu$ = this.menuSubject.asObservable();

  private api(path: string): string {
    return `${environment.apiBaseUrl}${path}`;
  }

  carregarMenu(forceRefresh = false): Observable<MenuItem[]> {
    if (this.cache && !forceRefresh) {
      this.menuSubject.next(this.cache);
      return of(this.cache);
    }

    return this.http.get<MenuItem[]>(this.api('/menu')).pipe(
      tap((items) => {
        this.cache = items;
        this.menuSubject.next(items);
      }),
      catchError(() => {
        const fallback = navDataToMenuTree();
        this.menuSubject.next(fallback);
        return of(fallback);
      })
    );
  }

  invalidarCache(): void {
    this.cache = null;
    this.carregarMenu(true).subscribe();
  }

  listarTodos(): Observable<MenuItem[]> {
    return this.http.get<MenuItem[]>(this.api('/menu/admin'));
  }

  criar(payload: MenuItemPayload): Observable<MenuItem> {
    return this.http.post<MenuItem>(this.api('/menu'), payload).pipe(
      tap(() => this.invalidarCache())
    );
  }

  atualizar(id: number, payload: MenuItemPayload): Observable<MenuItem> {
    return this.http.put<MenuItem>(this.api(`/menu/${id}`), payload).pipe(
      tap(() => this.invalidarCache())
    );
  }

  remover(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(this.api(`/menu/${id}`)).pipe(
      tap(() => this.invalidarCache())
    );
  }

  reordenar(items: MenuReorderItem[]): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(this.api('/menu/reorder'), items).pipe(
      tap(() => this.invalidarCache())
    );
  }

  getSnapshot(): MenuItem[] {
    return this.menuSubject.value;
  }
}
