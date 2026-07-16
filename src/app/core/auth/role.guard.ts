import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Role } from './role';
import { SessionService } from './session.service';

/**
 * Guard de rôle (factory) : bloque l'accès à un espace (étudiant / recruteur /
 * back-office modération) si le rôle courant ne correspond pas à `requiredRole`, et
 * redirige vers l'accueil public (`''`) dans ce cas.
 *
 * S'appuie sur `SessionService.currentRole`, état d'auth STUB en Épic 0 (voir
 * `session.service.ts`) — sera alimenté par la vraie session utilisateur une fois
 * l'intégration API branchée (Épic 1). La logique du guard elle-même (comparaison de
 * rôle + redirection) ne changera pas.
 *
 * Usage : `canActivate: [roleGuard('etudiant')]` sur la route racine de l'espace.
 */
export function roleGuard(requiredRole: Role): CanActivateFn {
  return () => {
    const sessionService = inject(SessionService);
    const router = inject(Router);

    if (sessionService.currentRole() === requiredRole) {
      return true;
    }

    return router.createUrlTree(['/']);
  };
}
