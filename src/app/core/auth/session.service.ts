import { Injectable, signal } from '@angular/core';

import { Role } from './role';

/**
 * État de session — STUB (Épic 0 : fondations techniques).
 *
 * Ce service ne fait AUCUN appel réseau et ne persiste rien : il simule en mémoire
 * l'état d'authentification courant afin de permettre de construire la navigation par
 * rôle (guards, layouts) avant que la vraie intégration API ne soit branchée.
 *
 * `currentRole` vaut `null` par défaut (visiteur non connecté, aucun espace protégé
 * accessible).
 *
 * À REMPLACER en Épic 1 par un service consommant réellement `studentapi`
 * (`/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`) — ne
 * pas construire de logique métier supplémentaire sur ce stub tant que ce remplacement
 * n'a pas eu lieu.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly role = signal<Role | null>(null);

  /** Rôle de l'utilisateur courant, `null` si non authentifié (visiteur). */
  readonly currentRole = this.role.asReadonly();

  /**
   * STUB uniquement : simule une connexion avec le rôle donné (ou une déconnexion via
   * `null`) en attendant la vraie intégration API (Épic 1). Ne reflète aucune session
   * réelle, ne doit pas être appelé depuis de la logique métier définitive.
   */
  setRole(role: Role | null): void {
    this.role.set(role);
  }
}
