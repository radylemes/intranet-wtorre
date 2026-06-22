import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { SolicitacaoColaboradorService } from '../services/solicitacao-colaborador.service';

export const solicitacaoViewerGuard: CanActivateFn = () => {
  const service = inject(SolicitacaoColaboradorService);
  const router = inject(Router);

  return service.podeVisualizar().pipe(
    map((res) => (res.pode_visualizar ? true : router.createUrlTree(['/inicio'])))
  );
};
