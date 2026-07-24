import { inject } from '@angular/core';
import { injectMutation, injectQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';

import { User } from '../../../core/auth/auth.types';
import { ModerationApiService } from './moderation-api.service';
import { moderationKeys } from './moderation.keys';
import {
  ModerationQueueParams,
  ModerationUrgentRequest,
  ModerationUrgentRequestPage,
  StudentProfile,
  UrgentQueueParams,
  UrgentRequestReviewRequest,
  VerificationRequest,
  VerificationRequestPage,
} from './moderation.types';

/**
 * Composables TanStack Query pour le domaine `/moderation/*` (file de vérification, réservé
 * au rôle `moderateur`). Chaque fonction `inject*` doit être appelée dans un contexte
 * d'injection (constructeur/champ de composant standalone, ou un autre composable appelé
 * depuis un tel contexte) — même contrainte que `injectQuery`/`injectMutation` eux-mêmes.
 * Elles encapsulent `ModerationApiService` (accès HTTP brut) derrière le pattern
 * query/mutation attendu par le projet (voir CLAUDE.md — "tout appel API passe par TanStack
 * Query"). Le Bearer est ajouté automatiquement par `authInterceptor` (FE3) : aucun token
 * géré manuellement ici.
 *
 * Le téléchargement de document (`GET /moderation/documents/{documentId}/content`) n'a
 * volontairement PAS de composable ici : c'est un flux binaire déclenché ponctuellement par
 * une action utilisateur (bouton "télécharger"), pas un état à mettre en cache/synchroniser
 * — le composant appelle directement `ModerationApiService.downloadDocument`.
 */

/**
 * `GET /moderation/verifications` — file paginée des demandes de vérification. `params` est
 * une fonction (pas une valeur) pour que la query key et le refetch réagissent aux
 * changements de filtre/pagination (signal-based, cohérent avec `injectQuery`).
 */
export function injectModerationQueueQuery(params: () => ModerationQueueParams) {
  const moderationApi = inject(ModerationApiService);

  return injectQuery(() => ({
    queryKey: moderationKeys.verifications(params()),
    queryFn: (): Promise<VerificationRequestPage> =>
      firstValueFrom(moderationApi.listVerifications(params())),
  }));
}

/**
 * `GET /moderation/verifications/{userId}` — détail d'une demande de vérification (utilisateur
 * + documents). Désactivée tant que `userId()` est `null` (ex. aucune ligne sélectionnée dans
 * la file).
 */
export function injectVerificationDetailQuery(userId: () => string | null) {
  const moderationApi = inject(ModerationApiService);

  return injectQuery(() => ({
    queryKey: moderationKeys.verification(userId() ?? ''),
    queryFn: (): Promise<VerificationRequest> =>
      firstValueFrom(moderationApi.getVerification(userId()!)),
    enabled: userId() !== null,
  }));
}

/**
 * `POST /moderation/verifications/{userId}/approve` — valide un profil (→ `verified` + badge).
 * Invalide `moderationKeys.all` après succès (liste ET détail) pour refléter immédiatement le
 * nouveau statut.
 */
export function injectApproveVerificationMutation() {
  const moderationApi = inject(ModerationApiService);
  const queryClient = inject(QueryClient);

  return injectMutation(() => ({
    mutationFn: (userId: string): Promise<User> => firstValueFrom(moderationApi.approve(userId)),
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: moderationKeys.all });
    },
  }));
}

/** Variables de `injectRejectVerificationMutation` : utilisateur ciblé + motif du rejet. */
export interface RejectVerificationVariables {
  userId: string;
  reason: string;
}

/**
 * `POST /moderation/verifications/{userId}/reject` — rejette un profil (→ `rejected` + motif).
 * Invalide `moderationKeys.all` après succès (liste ET détail).
 */
export function injectRejectVerificationMutation() {
  const moderationApi = inject(ModerationApiService);
  const queryClient = inject(QueryClient);

  return injectMutation(() => ({
    mutationFn: ({ userId, reason }: RejectVerificationVariables): Promise<User> =>
      firstValueFrom(moderationApi.reject(userId, reason)),
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: moderationKeys.all });
    },
  }));
}

/**
 * `GET /moderation/urgent-requests` — file paginée des demandes d'urgence. `params` est une
 * fonction (pas une valeur) pour que la query key et le refetch réagissent aux changements de
 * filtre/pagination (signal-based, cohérent avec `injectModerationQueueQuery`).
 */
export function injectUrgentQueueQuery(params: () => UrgentQueueParams) {
  const moderationApi = inject(ModerationApiService);

  return injectQuery(() => ({
    queryKey: moderationKeys.urgentQueue(params()),
    queryFn: (): Promise<ModerationUrgentRequestPage> =>
      firstValueFrom(moderationApi.listUrgentRequests(params())),
  }));
}

/** Variables de `injectReviewUrgentRequestMutation` : demande ciblée + décision de traitement. */
export interface ReviewUrgentRequestVariables {
  id: string;
  body: UrgentRequestReviewRequest;
}

/**
 * `POST /moderation/urgent-requests/{id}/review` — traite une demande d'urgence (classée en
 * priorité ou écartée). Invalide `moderationKeys.all` après succès (même stratégie que
 * `injectApproveVerificationMutation`/`injectRejectVerificationMutation`), ce qui recouvre la
 * file des urgences (`moderationKeys.urgentQueue`, imbriquée sous `moderationKeys.all`).
 */
export function injectReviewUrgentRequestMutation() {
  const moderationApi = inject(ModerationApiService);
  const queryClient = inject(QueryClient);

  return injectMutation(() => ({
    mutationFn: ({ id, body }: ReviewUrgentRequestVariables): Promise<ModerationUrgentRequest> =>
      firstValueFrom(moderationApi.reviewUrgentRequest(id, body)),
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: moderationKeys.all });
    },
  }));
}

/**
 * `GET /moderation/students/{userId}/profile` — vue modération du profil complet d'un
 * étudiant (champs sensibles inclus). Désactivée tant que `userId()` est `null` (ex. aucune
 * demande d'urgence/ligne sélectionnée), même contrainte que `injectVerificationDetailQuery`.
 */
export function injectModerationStudentProfileQuery(userId: () => string | null) {
  const moderationApi = inject(ModerationApiService);

  return injectQuery(() => ({
    queryKey: moderationKeys.studentProfile(userId() ?? ''),
    queryFn: (): Promise<StudentProfile> =>
      firstValueFrom(moderationApi.getStudentProfile(userId()!)),
    enabled: userId() !== null,
  }));
}
