import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { CamarotesService } from '../services/camarotes.service';

/** Permite acesso à página BI / Camarotes apenas para visualizadores autorizados. */
export const camarotesViewerGuard: CanActivateFn = () => {
  const camarotesService = inject(CamarotesService);
  const router = inject(Router);

  return camarotesService.podeVisualizar().pipe(
    map((res) => (res.pode_visualizar ? true : router.createUrlTree(['/inicio'])))
  );
};
