import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CategoriaDocumento,
  CategoriaDocumentoPayload,
  CategoriaReorderItem,
  Documento,
  DocumentoUpdatePayload,
} from '../models/documento.model';

@Injectable({ providedIn: 'root' })
export class DocumentosService {
  private readonly http = inject(HttpClient);

  private api(path: string): string {
    return `${environment.apiBaseUrl}${path}`;
  }

  listarCategorias(): Observable<CategoriaDocumento[]> {
    return this.http.get<CategoriaDocumento[]>(this.api('/doc-categorias'));
  }

  listarCategoriasAdmin(): Observable<CategoriaDocumento[]> {
    return this.http.get<CategoriaDocumento[]>(this.api('/doc-categorias/admin'));
  }

  listarDocumentos(categoriaIdOrSlug: string | number): Observable<Documento[]> {
    return this.http.get<Documento[]>(this.api('/documentos'), {
      params: { categoria: String(categoriaIdOrSlug) },
    });
  }

  urlView(id: number): string {
    return this.api(`/documentos/${id}/view`);
  }

  urlDownload(id: number): string {
    return this.api(`/documentos/${id}/download`);
  }

  visualizar(id: number): Observable<Blob> {
    return this.http.get(this.urlView(id), { responseType: 'blob' });
  }

  baixar(id: number): Observable<Blob> {
    return this.http.get(this.urlDownload(id), { responseType: 'blob' });
  }

  criarCategoria(payload: CategoriaDocumentoPayload): Observable<CategoriaDocumento> {
    return this.http.post<CategoriaDocumento>(this.api('/doc-categorias'), payload);
  }

  atualizarCategoria(id: number, payload: CategoriaDocumentoPayload): Observable<CategoriaDocumento> {
    return this.http.put<CategoriaDocumento>(this.api(`/doc-categorias/${id}`), payload);
  }

  removerCategoria(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(this.api(`/doc-categorias/${id}`));
  }

  reordenarCategorias(items: CategoriaReorderItem[]): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(this.api('/doc-categorias/reorder'), items);
  }

  uploadDocumento(formData: FormData): Observable<HttpEvent<Documento>> {
    return this.http.post<Documento>(this.api('/documentos'), formData, {
      reportProgress: true,
      observe: 'events',
    });
  }

  atualizarDocumento(id: number, payload: DocumentoUpdatePayload): Observable<Documento> {
    return this.http.put<Documento>(this.api(`/documentos/${id}`), payload);
  }

  removerDocumento(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(this.api(`/documentos/${id}`));
  }

  downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  isUploadProgress(event: HttpEvent<unknown>): event is HttpEvent<Documento> & { type: typeof HttpEventType.UploadProgress } {
    return event.type === HttpEventType.UploadProgress;
  }
}
