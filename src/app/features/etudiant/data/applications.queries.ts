import { inject } from '@angular/core';
import { injectMutation, injectQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';

import { ApplicationsApiService } from './applications-api.service';
import { applicationsKeys } from './applications.keys';
import {
  ApplicationCreateRequest,
  StudentApplication,
  StudentApplicationListParams,
  StudentApplicationPage,
} from './applications.types';

/**
 * Composables TanStack Query pour le domaine `applications` (candidatures de l'étudiant
 * courant). Chaque fonction `inject*` doit être appelée dans un contexte d'injection
 * (constructeur/champ de composant standalone, ou un autre composable appelé depuis un tel
 * contexte) — même contrainte que `injectQuery`/`injectMutation` eux-mêmes. Elles encapsulent
 * `ApplicationsApiService` (accès HTTP brut) derrière le pattern query/mutation attendu par le
 * projet (voir CLAUDE.md — "tout appel API passe par TanStack Query"). Le Bearer est ajouté
 * automatiquement par `authInterceptor` (FE3) : aucun token géré manuellement ici.
 */

/** Variables de `injectApplyMutation` : offre visée + corps de candidature. */
export interface ApplyVariables {
  offerId: string;
  body: ApplicationCreateRequest;
}

/**
 * `POST /offers/{offerId}/applications` — dépose une candidature (statut initial
 * `pending_moderation`). Invalide `applicationsKeys.all` après succès pour que la liste des
 * candidatures reflète immédiatement la nouvelle candidature.
 */
export function injectApplyMutation() {
  const applicationsApi = inject(ApplicationsApiService);
  const queryClient = inject(QueryClient);

  return injectMutation(() => ({
    mutationFn: ({ offerId, body }: ApplyVariables): Promise<StudentApplication> =>
      firstValueFrom(applicationsApi.apply(offerId, body)),
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: applicationsKeys.all });
    },
  }));
}

/**
 * `GET /students/me/applications` — page des candidatures de l'étudiant courant. `params` est
 * une fonction (pas une valeur) pour que la query key et le refetch réagissent aux changements
 * de filtre/pagination (signal-based, cohérent avec `injectModerationQueueQuery`).
 */
export function injectStudentApplicationsQuery(params: () => StudentApplicationListParams) {
  const applicationsApi = inject(ApplicationsApiService);

  return injectQuery(() => ({
    queryKey: applicationsKeys.list(params()),
    queryFn: (): Promise<StudentApplicationPage> =>
      firstValueFrom(applicationsApi.listApplications(params())),
  }));
}

/**
 * `GET /students/me/applications/{applicationId}` — détail d'une candidature de l'étudiant
 * courant. Désactivée tant que `applicationId()` est `null` (ex. paramètre de route pas encore
 * résolu), même contrainte que `injectVerificationDetailQuery`.
 */
export function injectStudentApplicationDetailQuery(applicationId: () => string | null) {
  const applicationsApi = inject(ApplicationsApiService);

  return injectQuery(() => ({
    queryKey: applicationsKeys.detail(applicationId() ?? ''),
    queryFn: (): Promise<StudentApplication> =>
      firstValueFrom(applicationsApi.getApplication(applicationId()!)),
    enabled: applicationId() !== null,
  }));
}

/**
 * `DELETE /students/me/applications/{applicationId}` — retire une candidature (→ `withdrawn`).
 * Invalide `applicationsKeys.all` après succès (liste ET détail).
 */
export function injectWithdrawApplicationMutation() {
  const applicationsApi = inject(ApplicationsApiService);
  const queryClient = inject(QueryClient);

  return injectMutation(() => ({
    mutationFn: (applicationId: string): Promise<void> =>
      firstValueFrom(applicationsApi.withdraw(applicationId)),
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: applicationsKeys.all });
    },
  }));
}

/**
 * `POST /students/me/applications/{applicationId}/accept` — accepte le dévoilement de son
 * identité après sélection (`selected` → `accepted`). Invalide `applicationsKeys.all` après
 * succès (liste ET détail).
 */
export function injectAcceptApplicationMutation() {
  const applicationsApi = inject(ApplicationsApiService);
  const queryClient = inject(QueryClient);

  return injectMutation(() => ({
    mutationFn: (applicationId: string): Promise<StudentApplication> =>
      firstValueFrom(applicationsApi.accept(applicationId)),
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: applicationsKeys.all });
    },
  }));
}

/**
 * `POST /students/me/applications/{applicationId}/decline` — refuse le dévoilement de son
 * identité après sélection (`selected` → `declined`). Invalide `applicationsKeys.all` après
 * succès (liste ET détail).
 */
export function injectDeclineApplicationMutation() {
  const applicationsApi = inject(ApplicationsApiService);
  const queryClient = inject(QueryClient);

  return injectMutation(() => ({
    mutationFn: (applicationId: string): Promise<StudentApplication> =>
      firstValueFrom(applicationsApi.decline(applicationId)),
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: applicationsKeys.all });
    },
  }));
}
