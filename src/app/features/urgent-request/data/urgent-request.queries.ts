import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { injectMutation, injectQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';

import { UrgentRequestApiService } from './urgent-request-api.service';
import { urgentRequestKeys } from './urgent-request.keys';
import { UrgentRequest, UrgentRequestCreateRequest } from './urgent-request.types';

/**
 * Composables TanStack Query pour le domaine `/students/me/urgent-request` (demande d'urgence
 * de l'utilisateur courant, rôle `etudiant`). Chaque fonction `inject*` doit être appelée dans
 * un contexte d'injection (constructeur/champ de composant standalone, ou un autre composable
 * appelé depuis un tel contexte) — même contrainte que `injectQuery`/`injectMutation`
 * eux-mêmes. Elles encapsulent `UrgentRequestApiService` (accès HTTP brut) derrière le pattern
 * query/mutation attendu par le projet (voir CLAUDE.md — "tout appel API passe par TanStack
 * Query"). Le Bearer est ajouté automatiquement par `authInterceptor` (FE3) : aucun token géré
 * manuellement ici.
 */

/**
 * `GET /students/me/urgent-request` — dernière demande d'urgence de l'étudiant courant.
 *
 * Traitement du 404 `URGENT_REQUEST_NOT_FOUND` (choix documenté ici car c'est le seul endroit
 * de la couche data qui porte de la logique dessus) : c'est un cas métier NORMAL — aucune
 * demande d'urgence en cours — PAS une panne. Retenter ne changerait pas le résultat et
 * retarderait juste inutilement l'affichage de l'écran (T14) le temps des tentatives par
 * défaut de TanStack Query (3, avec backoff exponentiel). Le `retry` ci-dessous désactive donc
 * les tentatives UNIQUEMENT sur ce cas, en conservant le comportement par défaut (jusqu'à 3
 * tentatives) pour toute autre erreur (réseau, 5xx…) où retenter a un sens.
 *
 * La query se retrouve malgré tout en état `isError`/`isError()` sur un 404 : ce service ne
 * transforme jamais un 404 en réponse `null`/succès (l'API ne renvoie pas ce cas en 200 — voir
 * `urgent-request-api.service.ts`). C'est donc à l'écran consommateur de distinguer les deux
 * cas en inspectant `query.error()` : `HttpErrorResponse` avec `status === 404` -> aucune
 * demande en cours (état neutre à afficher, ex. bouton "signaler une urgence") ; tout le reste
 * -> vraie erreur à signaler.
 */
export function injectUrgentRequestQuery() {
  const urgentRequestApi = inject(UrgentRequestApiService);

  return injectQuery(() => ({
    queryKey: urgentRequestKeys.me(),
    queryFn: (): Promise<UrgentRequest> => firstValueFrom(urgentRequestApi.getUrgentRequest()),
    retry: (failureCount: number, error: Error): boolean => {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        return false;
      }
      return failureCount < 3;
    },
  }));
}

/**
 * `POST /students/me/urgent-request` — dépose une demande d'urgence (message de détresse).
 * Invalide `urgentRequestKeys.all` (donc `me()`) après succès pour refléter immédiatement le
 * nouveau statut `pending` côté écran (T14).
 */
export function injectCreateUrgentRequestMutation() {
  const urgentRequestApi = inject(UrgentRequestApiService);
  const queryClient = inject(QueryClient);

  return injectMutation(() => ({
    mutationFn: (body: UrgentRequestCreateRequest): Promise<UrgentRequest> =>
      firstValueFrom(urgentRequestApi.createUrgentRequest(body)),
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: urgentRequestKeys.all });
    },
  }));
}
