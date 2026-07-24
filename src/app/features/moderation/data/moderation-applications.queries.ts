import { inject } from '@angular/core';
import { injectMutation, injectQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';

import { ModerationApplicationsApiService } from './moderation-applications-api.service';
import { moderationApplicationsKeys } from './moderation-applications.keys';
import {
  ModerationApplication,
  ModerationApplicationPage,
  ModerationApplicationsQueueParams,
} from './moderation-applications.types';

/**
 * Composables TanStack Query pour le domaine `/moderation/applications/*` (file de
 * candidatures, réservée au rôle `moderateur` — Épic 3). Chaque fonction `inject*` doit être
 * appelée dans un contexte d'injection (constructeur/champ de composant standalone) — même
 * contrainte que `injectQuery`/`injectMutation` eux-mêmes. Elles encapsulent
 * `ModerationApplicationsApiService` (accès HTTP brut) derrière le pattern query/mutation
 * attendu par le projet (voir CLAUDE.md — "tout appel API passe par TanStack Query"). Le
 * Bearer est ajouté automatiquement par `authInterceptor` (FE3) : aucun token géré
 * manuellement ici.
 *
 * Fichier NEUF, volontairement séparé de `moderation.queries.ts` (Épic 1/2) — voir périmètre
 * de la tâche « candidatures ».
 */

/**
 * `GET /moderation/applications` — file paginée des candidatures. `params` est une fonction
 * (pas une valeur) pour que la query key et le refetch réagissent aux changements de
 * filtre/pagination (signal-based, cohérent avec `injectModerationQueueQuery`).
 */
export function injectModerationApplicationsQueueQuery(
  params: () => ModerationApplicationsQueueParams,
) {
  const applicationsApi = inject(ModerationApplicationsApiService);

  return injectQuery(() => ({
    queryKey: moderationApplicationsKeys.list(params()),
    queryFn: (): Promise<ModerationApplicationPage> =>
      firstValueFrom(applicationsApi.list(params())),
  }));
}

/**
 * `GET /moderation/applications/{applicationId}` — détail d'une candidature (offre + profil
 * étudiant complet). Désactivée tant que `applicationId()` est `null` (ex. route non encore
 * résolue).
 */
export function injectModerationApplicationDetailQuery(applicationId: () => string | null) {
  const applicationsApi = inject(ModerationApplicationsApiService);

  return injectQuery(() => ({
    queryKey: moderationApplicationsKeys.detail(applicationId() ?? ''),
    queryFn: (): Promise<ModerationApplication> =>
      firstValueFrom(applicationsApi.get(applicationId()!)),
    enabled: applicationId() !== null,
  }));
}

/**
 * `POST /moderation/applications/{applicationId}/approve` — transmet la candidature au
 * recruteur (`pending_moderation` → `forwarded`). Invalide `moderationApplicationsKeys.all`
 * après succès (liste ET détail) pour refléter immédiatement le nouveau statut.
 */
export function injectApproveModerationApplicationMutation() {
  const applicationsApi = inject(ModerationApplicationsApiService);
  const queryClient = inject(QueryClient);

  return injectMutation(() => ({
    mutationFn: (applicationId: string): Promise<ModerationApplication> =>
      firstValueFrom(applicationsApi.approve(applicationId)),
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: moderationApplicationsKeys.all });
    },
  }));
}

/** Variables de `injectRejectModerationApplicationMutation` : candidature ciblée + motif du rejet. */
export interface RejectModerationApplicationVariables {
  applicationId: string;
  reason: string;
}

/**
 * `POST /moderation/applications/{applicationId}/reject` — rejette la candidature en
 * modération (`pending_moderation` → `rejected_moderation`). Invalide
 * `moderationApplicationsKeys.all` après succès (liste ET détail).
 */
export function injectRejectModerationApplicationMutation() {
  const applicationsApi = inject(ModerationApplicationsApiService);
  const queryClient = inject(QueryClient);

  return injectMutation(() => ({
    mutationFn: ({
      applicationId,
      reason,
    }: RejectModerationApplicationVariables): Promise<ModerationApplication> =>
      firstValueFrom(applicationsApi.reject(applicationId, reason)),
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: moderationApplicationsKeys.all });
    },
  }));
}
