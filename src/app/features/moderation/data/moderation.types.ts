import type { User, VerificationStatus } from '../../../core/auth/auth.types';
import type { DocumentType, VerificationDocument } from '../../verification/data/verification.types';

/**
 * Types miroir du domaine `moderation` du contrat d'API partagé `studentapi`
 * (`docs/openapi.yaml`, v0.2.0, tag `moderation`, `components.schemas`). Ce fichier CONSOMME
 * le contrat, il ne le définit pas : toute évolution (champ ajouté/retiré, renommage, valeur
 * d'enum) doit d'abord être décidée côté contrat par l'orchestrateur, jamais improvisée ici.
 *
 * Périmètre : `/moderation/*` (file de vérification, réservé au rôle `moderateur` +
 * délégués/responsables universitaires associés). Le recruteur n'a jamais accès direct à ces
 * données (voir CLAUDE.md — "le recruteur ne voit jamais les profils étudiants bruts").
 */

// Réexportés pour que ce module reste un point d'entrée pratique pour les consommateurs
// (composants moderation) sans avoir à connaître le découpage exact des modules `core`/`verification`.
export type { User, VerificationStatus, DocumentType, VerificationDocument };

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
 * Codes machine (`ErrorResponse.error`) renvoyés par les endpoints `/moderation/*` pour les
 * cas d'erreur métier documentés dans le contrat — à utiliser côté UI (ex. `switch` pour un
 * message/action localisé) : JAMAIS en parsant `ErrorResponse.message`, qui est traduit
 * (i18n) et donc instable pour de la logique.
 */
export type ModerationErrorCode = 'MODERATION_INVALID_STATE';

/**
 * `components.schemas.ErrorResponse` — format d'erreur générique partagé par toute l'API
 * `studentapi`. Pas encore hébergé dans un module `core/http` commun (aucun n'existe dans ce
 * repo à ce jour, et sa création est hors périmètre de cette tâche) : redéfini ici localement,
 * avec `error` restreint au sous-ensemble de codes métier propres à `/moderation/*` pour
 * permettre un `switch`/narrowing sûr côté UI sur le corps d'un `HttpErrorResponse.error`.
 */
export interface ModerationErrorResponse {
  statusCode: number;
  error: ModerationErrorCode;
  message: string;
  timestamp: string;
  path: string;
}
