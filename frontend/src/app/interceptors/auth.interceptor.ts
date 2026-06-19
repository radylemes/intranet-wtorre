import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/login-microsoft',
  '/auth/refresh',
  '/tenants/msal-config',
  '/assinaturas/instalar-assinaturas.ps1',
  '/assinaturas/instalar-assinaturas-base.ps1',
  '/assinaturas/config/',
];

function isApiRequest(url: string): boolean {
  return url.includes('/api/v1') || url.startsWith('/api/');
}

function isPublic(url: string): boolean {
  if (!isApiRequest(url)) return true;
  return PUBLIC_PATHS.some((p) => url.includes(p));
}

function usesGraphToken(url: string): boolean {
  return isApiRequest(url) && url.includes('/assinaturas/me');
}

function shouldAttachToken(url: string): boolean {
  return isApiRequest(url) && !isPublic(url) && !usesGraphToken(url);
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  let request = req;

  const token = auth.getToken();
  if (token && shouldAttachToken(req.url)) {
    request = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(request).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || isPublic(req.url) || req.url.includes('/auth/refresh')) {
        return throwError(() => err);
      }

      return auth.refresh().pipe(
        switchMap((refreshed) => {
          if (!refreshed?.accessToken) {
            auth.logout(true, false);
            return throwError(() => err);
          }
          const retry = req.clone({
            setHeaders: { Authorization: `Bearer ${refreshed.accessToken}` },
          });
          return next(retry);
        }),
        catchError(() => {
          auth.logout(true, false);
          return throwError(() => err);
        })
      );
    })
  );
};
