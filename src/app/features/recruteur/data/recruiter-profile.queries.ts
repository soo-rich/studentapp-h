import { inject } from '@angular/core';
import { injectMutation, injectQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';

import { RecruiterProfileApiService } from './recruiter-profile-api.service';
import { recruiterProfileKeys } from './recruiter-profile.keys';
import { RecruiterProfile, RecruiterProfileUpsertRequest } from './recruiter-profile.types';

/**
 * Composables TanStack Query pour le domaine `/recruiters/me/profile` (profil de structure du
 * recruteur courant). Chaque fonction `inject*` doit être appelée dans un contexte
 * d'injection (constructeur/champ de composant standalone, ou un autre composable appelé
 * depuis un tel contexte) — même contrainte que `injectQuery`/`injectMutation` eux-mêmes.
 * Elles encapsulent `RecruiterProfileApiService` (accès HTTP brut) derrière le pattern
 * query/mutation attendu par le projet (voir CLAUDE.md — "tout appel API passe par TanStack
 * Query"). Le Bearer est ajouté automatiquement par `authInterceptor` (FE3) : aucun token
 * géré manuellement ici.
 */

/**
 * `GET /recruiters/me/profile` — profil de structure du recruteur courant. Peut échouer en
 * 404 `RECRUITER_PROFILE_NOT_FOUND` (profil pas encore créé) : à gérer côté UI via
 * `query.error()`, cas NOMINAL (formulaire vierge), pas une erreur affichée.
 */
export function injectRecruiterProfileQuery() {
  const recruiterProfileApi = inject(RecruiterProfileApiService);

  return injectQuery(() => ({
    queryKey: recruiterProfileKeys.me(),
    queryFn: (): Promise<RecruiterProfile> => firstValueFrom(recruiterProfileApi.getProfile()),
  }));
}

/**
 * `PUT /recruiters/me/profile` — crée ou met à jour le profil de la structure du recruteur
 * courant (upsert idempotent). Invalide `recruiterProfileKeys.all` après succès pour refléter
 * immédiatement les données enregistrées.
 */
export function injectUpsertRecruiterProfileMutation() {
  const recruiterProfileApi = inject(RecruiterProfileApiService);
  const queryClient = inject(QueryClient);

  return injectMutation(() => ({
    mutationFn: (body: RecruiterProfileUpsertRequest): Promise<RecruiterProfile> =>
      firstValueFrom(recruiterProfileApi.upsertProfile(body)),
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: recruiterProfileKeys.all });
    },
  }));
}
