import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/auth.service';

function sessaoAtiva(auth: AuthService): boolean {
  return auth.temAccessValido();
}

/** Redireciona utilizadores autenticados para fora da página de login. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (sessaoAtiva(auth)) {
    return router.createUrlTree(['/inicio']);
  }

  return auth.ensureSession().pipe(
    map((ok) => (ok || sessaoAtiva(auth) ? router.createUrlTree(['/inicio']) : true))
  );
};
