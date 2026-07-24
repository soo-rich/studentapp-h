import type { ApiErrorResponse } from '../../../core/http/api-error.types';
import type { OpportunityType } from '../../profile/data/profile.types';

/**
 * Types miroir du domaine `applications` du contrat d'API partagé `studentapi`
 * (`docs/openapi.yaml`, v0.4.0, tag `applications`, `components.schemas`). Ce fichier CONSOMME
 * le contrat, il ne le définit pas : toute évolution (champ ajouté/retiré, renommage, valeur
 * d'enum) doit d'abord être décidée côté contrat par l'orchestrateur, jamais improvisée ici.
 *
 * Périmètre : `POST /offers/{offerId}/applications` et `/students/me/applications*` —
 * candidatures de l'étudiant COURANT uniquement. PAS `/moderation/applications*` (file de
 * filtrage, réservée au rôle `moderateur`) ni les endpoints de gestion côté recruteur, hors
 * périmètre de cette tâche.
 */

// Réexporté depuis `features/profile/data/profile.types` (Épic 2) : `OpportunityType` est
// partagé par tout le domaine étudiant — ce module ne le redéclare pas, il le réexporte pour
// rester un point d'entrée pratique pour les consommateurs (écrans `features/etudiant/candidatures/**`).
export type { OpportunityType };

/**
 * `components.schemas.ApplicationStatus` — cycle de vie d'une candidature.
 * `pending_moderation` : soumise, en attente de filtrage.
 * `forwarded` : approuvée par la modération, transmise au recruteur (fiche anonyme).
 * `rejected_moderation` : recalée par la modération (terminal), motif communiqué.
 * `selected` : le recruteur a retenu le candidat, en attente de l'accord de l'étudiant.
 * `accepted` : l'étudiant a accepté le dévoilement de son identité (mise en relation).
 * `declined` : l'étudiant a refusé le dévoilement (terminal).
 * `rejected_by_recruiter` : le recruteur a écarté le candidat transmis (terminal).
 * `withdrawn` : l'étudiant a retiré sa candidature (terminal).
 */
export type ApplicationStatus =
  | 'pending_moderation'
  | 'forwarded'
  | 'rejected_moderation'
  | 'selected'
  | 'accepted'
  | 'declined'
  | 'rejected_by_recruiter'
  | 'withdrawn';

/** `components.schemas.OfferSummary` — résumé d'offre embarqué dans une candidature. */
export interface OfferSummary {
  id: string;
  title: string;
  opportunityType: OpportunityType;
  /** Nom de la structure du recruteur (public). */
  structureName: string;
}

/** `components.schemas.ApplicationCreateRequest` — corps de `POST /offers/{offerId}/applications`. */
export interface ApplicationCreateRequest {
  /** Message de motivation optionnel, transmis à la modération. Contrainte backend : max 1000. */
  message?: string | null;
}

/** `components.schemas.StudentApplication` — candidature vue par l'étudiant qui l'a déposée. */
export interface StudentApplication {
  id: string;
  offer: OfferSummary;
  status: ApplicationStatus;
  message?: string | null;
  /**
   * Motif renseigné uniquement lorsque `status` = `rejected_moderation`. `null`/absent sinon.
   */
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `components.schemas.StudentApplicationPage` — page paginée de `StudentApplication`. */
export interface StudentApplicationPage {
  items: StudentApplication[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Paramètres de `GET /students/me/applications`. Défauts appliqués par le backend si omis :
 * `page = 1`, `pageSize = 20` (max `pageSize = 100`).
 */
export interface StudentApplicationListParams {
  status?: ApplicationStatus;
  page?: number;
  pageSize?: number;
}

/**
 * Codes machine (`ErrorResponse.error`) renvoyés par `/offers/{offerId}/applications` et
 * `/students/me/applications*` pour les cas d'erreur métier documentés dans le contrat — à
 * utiliser côté UI (ex. `switch` pour un message/action localisé) : JAMAIS en parsant
 * `ErrorResponse.message`, qui est traduit (i18n) et donc instable pour de la logique.
 */
export type ApplicationErrorCode =
  | 'OFFER_NOT_FOUND'
  | 'APPLICATION_ALREADY_EXISTS'
  | 'OFFER_NOT_OPEN'
  | 'PROFILE_REQUIRED'
  | 'APPLICATION_NOT_FOUND'
  | 'APPLICATION_NOT_WITHDRAWABLE'
  | 'APPLICATION_INVALID_STATE';

/**
 * `components.schemas.ErrorResponse` — format d'erreur générique partagé par toute l'API
 * `studentapi`, dérivé du type central `core/http/api-error.types.ts` avec `error` restreint
 * au sous-ensemble de codes métier propres au domaine `applications` pour permettre un
 * `switch`/narrowing sûr côté UI sur le corps d'un `HttpErrorResponse.error`.
 */
export type ApplicationErrorResponse = Omit<ApiErrorResponse, 'error'> & {
  error: ApplicationErrorCode;
};
