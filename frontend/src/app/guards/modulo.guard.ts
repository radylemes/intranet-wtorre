import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { rotaParaModulo } from '../data/admin-modulos';

function redirectSemModulo(): ReturnType<Router['createUrlTree']> {
  const auth = inject(AuthService);
  const router = inject(Router);
  const fallback = auth.primeiraRotaAdmin();
  if (fallback) {
    return router.createUrlTree(['/admin', fallback]);
  }
  return router.createUrlTree(['/inicio']);
}

export const moduloGuard = (codigo: string): CanActivateFn => () => {
  const auth = inject(AuthService);
  if (auth.estaLogado() && auth.hasModulo(codigo)) {
    return true;
  }
  return redirectSemModulo();
};

export const moduloGuardFromRoute: CanActivateFn = (route) => {
  const path = route.routeConfig?.path;
  const codigo = path ? rotaParaModulo(path) : null;
  if (!codigo) return true;

  const auth = inject(AuthService);
  if (auth.estaLogado() && auth.hasModulo(codigo)) {
    return true;
  }
  return redirectSemModulo();
};
