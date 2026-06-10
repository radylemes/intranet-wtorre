import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';

const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/refresh',
  '/tenants/msal-config',
];

function isPublic(url: string): boolean {
  if (!url.includes(environment.apiBaseUrl)) return true;
  return PUBLIC_PATHS.some((p) => url.includes(p));
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  let request = req;

  const token = auth.getToken();
  if (token && !isPublic(req.url)) {
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
            auth.logout();
            return throwError(() => err);
          }
          const retry = req.clone({
            setHeaders: { Authorization: `Bearer ${refreshed.accessToken}` },
          });
          return next(retry);
        }),
        catchError(() => {
          auth.logout();
          return throwError(() => err);
        })
      );
    })
  );
};
