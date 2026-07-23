import { inject } from '@angular/core';
import { injectMutation, injectQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';

import { ProfileApiService } from './profile-api.service';
import { profileKeys } from './profile.keys';
import { StudentProfile, StudentProfileUpsertRequest } from './profile.types';

/**
 * Composables TanStack Query pour le domaine `/students/me/profile` (profil détaillé de
 * l'étudiant courant). Chaque fonction `inject*` doit être appelée dans un contexte
 * d'injection (constructeur/champ de composant standalone, ou un autre composable appelé
 * depuis un tel contexte) — même contrainte que `injectQuery`/`injectMutation` eux-mêmes.
 * Elles encapsulent `ProfileApiService` (accès HTTP brut) derrière le pattern query/mutation
 * attendu par le projet (voir CLAUDE.md — "tout appel API passe par TanStack Query"). Le
 * Bearer est ajouté automatiquement par `authInterceptor` (FE3) : aucun token géré
 * manuellement ici.
 */

/**
 * `GET /students/me/profile` — profil complet de l'étudiant courant (champs sensibles
 * inclus). Peut échouer en 404 `PROFILE_NOT_FOUND` (profil pas encore créé) : à gérer côté UI
 * via `query.error()`.
 */
export function injectStudentProfileQuery() {
  const profileApi = inject(ProfileApiService);

  return injectQuery(() => ({
    queryKey: profileKeys.me(),
    queryFn: (): Promise<StudentProfile> => firstValueFrom(profileApi.getProfile()),
  }));
}

/**
 * `PUT /students/me/profile` — crée ou met à jour le profil de l'étudiant courant (upsert
 * idempotent). Invalide `profileKeys.me()`/`profileKeys.all` après succès pour refléter
 * immédiatement les données enregistrées.
 */
export function injectUpsertStudentProfileMutation() {
  const profileApi = inject(ProfileApiService);
  const queryClient = inject(QueryClient);

  return injectMutation(() => ({
    mutationFn: (body: StudentProfileUpsertRequest): Promise<StudentProfile> =>
      firstValueFrom(profileApi.upsertProfile(body)),
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.all });
    },
  }));
}
