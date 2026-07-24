import type { User, VerificationStatus } from '../../../core/auth/auth.types';
import type { ApiErrorResponse } from '../../../core/http/api-error.types';
import type { DocumentType, VerificationDocument } from '../../verification/data/verification.types';
import type {
  AvailabilitySlot,
  DayOfWeek,
  HousingSituation,
  OpportunityType,
  StudentProfile,
} from '../../profile/data/profile.types';
import type { UrgentRequestStatus } from '../../urgent-request/data/urgent-request.types';

/**
 * Types miroir du domaine `moderation` du contrat d'API partagé `studentapi`
 * (`docs/openapi.yaml`, v0.3.0, tag `moderation`, `components.schemas`). Ce fichier CONSOMME
 * le contrat, il ne le définit pas : toute évolution (champ ajouté/retiré, renommage, valeur
 * d'enum) doit d'abord être décidée côté contrat par l'orchestrateur, jamais improvisée ici.
 *
 * Périmètre : `/moderation/*` (file de vérification, file des demandes d'urgence, et vue
 * modération du profil étudiant complet — réservé au rôle `moderateur` + délégués/responsables
 * universitaires associés). Le recruteur n'a jamais accès direct à ces données (voir
 * CLAUDE.md — "le recruteur ne voit jamais les profils étudiants bruts").
 */

// Réexportés pour que ce module reste un point d'entrée pratique pour les consommateurs
// (composants moderation) sans avoir à connaître le découpage exact des modules `core`/`verification`.
export type { User, VerificationStatus, DocumentType, VerificationDocument };

// Réexportés depuis `features/profile/data/profile.types` (Épic 2, T10) : la vue modération du
// profil étudiant (`GET /moderation/students/{userId}/profile`) utilise le même schéma
// `StudentProfile` (champs sensibles inclus) que la vue étudiant elle-même — ce module ne
// redéclare pas ces types, il les réexporte pour rester un point d'entrée pratique.
export type { AvailabilitySlot, DayOfWeek, HousingSituation, OpportunityType, StudentProfile };

// Réexporté depuis `features/urgent-request/data/urgent-request.types` (Épic 2, T11) : la file
// de modération des demandes d'urgence partage le même statut que la vue étudiant.
export type { UrgentRequestStatus };

/**
 * `components.schemas.VerificationRequest` — vue modération d'une demande : l'utilisateur
 * concerné + ses documents. N'expose aucune donnée métier sensible du profil (celles-ci
 * relèvent des Épics 2/3 et ne sont visibles que de la modération, jamais du recruteur).
 */
export interface VerificationRequest {
  user: User;
  documents: VerificationDocument[];
  submittedAt: string;
}

/** `components.schemas.VerificationRequestPage` — page paginée de `VerificationRequest`. */
export interface VerificationRequestPage {
  items: VerificationRequest[];
  page: number;
  pageSize: number;
  /** Nombre total de demandes correspondant au filtre. */
  total: number;
}

/**
 * `components.schemas.VerificationRejectRequest` — corps de
 * `POST /moderation/verifications/{userId}/reject`.
 */
export interface VerificationRejectRequest {
  /** Motif du rejet, communiqué à l'utilisateur. Contrainte backend : 3 à 500 caractères. */
  reason: string;
}

/**
 * Paramètres de `GET /moderation/verifications`. Défauts appliqués par le backend si omis :
 * `status = 'pending'`, `page = 1`, `pageSize = 20` (max `pageSize = 100`).
 */
export interface ModerationQueueParams {
  status?: VerificationStatus;
  page?: number;
  pageSize?: number;
}

/**
 * `components.schemas.ModerationUrgentRequest` — demande d'urgence enrichie de l'utilisateur
 * émetteur, pour la vue modération (`GET /moderation/urgent-requests`,
 * `POST /moderation/urgent-requests/{id}/review`).
 */
export interface ModerationUrgentRequest {
  id: string;
  status: UrgentRequestStatus;
  message: string;
  /** Note laissée par la modération lors du traitement, `null` sinon. */
  moderatorNote: string | null;
  user: User;
  createdAt: string;
  /** Date de traitement, `null` tant que `pending`. */
  reviewedAt: string | null;
}

/** `components.schemas.ModerationUrgentRequestPage` — page paginée de `ModerationUrgentRequest`. */
export interface ModerationUrgentRequestPage {
  items: ModerationUrgentRequest[];
  page: number;
  pageSize: number;
  /** Nombre total de demandes correspondant au filtre. */
  total: number;
}

/**
 * `components.schemas.UrgentRequestReviewRequest` — corps de
 * `POST /moderation/urgent-requests/{id}/review`. `decision = 'prioritize'` → statut
 * `prioritized` ; `decision = 'dismiss'` → statut `dismissed`.
 */
export interface UrgentRequestReviewRequest {
  decision: 'prioritize' | 'dismiss';
  /** Note interne optionnelle de la modération. Contrainte backend : max 500 caractères. */
  note?: string | null;
}

/**
 * Paramètres de `GET /moderation/urgent-requests`. Défauts appliqués par le backend si omis :
 * `status = 'pending'`, `page = 1`, `pageSize = 20` (max `pageSize = 100`).
 */
export interface UrgentQueueParams {
  status?: UrgentRequestStatus;
  page?: number;
  pageSize?: number;
}

/**
 * Codes machine (`ErrorResponse.error`) renvoyés par les endpoints `/moderation/*` pour les
 * cas d'erreur métier documentés dans le contrat — à utiliser côté UI (ex. `switch` pour un
 * message/action localisé) : JAMAIS en parsant `ErrorResponse.message`, qui est traduit
 * (i18n) et donc instable pour de la logique.
 */
export type ModerationErrorCode =
  | 'MODERATION_INVALID_STATE'
  | 'URGENT_REQUEST_NOT_FOUND'
  | 'URGENT_REQUEST_INVALID_STATE'
  | 'PROFILE_NOT_FOUND';

/**
 * `components.schemas.ErrorResponse` — format d'erreur générique partagé par toute l'API
 * `studentapi`, dérivé du type central `core/http/api-error.types.ts` avec `error` restreint
 * au sous-ensemble de codes métier propres à `/moderation/*` pour permettre un
 * `switch`/narrowing sûr côté UI sur le corps d'un `HttpErrorResponse.error`.
 */
export type ModerationErrorResponse = Omit<ApiErrorResponse, 'error'> & {
  error: ModerationErrorCode;
};
