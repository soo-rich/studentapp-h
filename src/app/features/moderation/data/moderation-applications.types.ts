import type { ApiErrorResponse } from '../../../core/http/api-error.types';
import type {
  AvailabilitySlot,
  DayOfWeek,
  HousingSituation,
  OpportunityType,
  StudentProfile,
} from '../../profile/data/profile.types';

/**
 * Types miroir du domaine `applications` (candidatures) du contrat d'API partagé `studentapi`
 * (`docs/openapi.yaml`, v0.4.0, tag `applications`, `components.schemas`), périmètre
 * `/moderation/applications/*` (file de modération des candidatures, réservé au rôle
 * `moderateur` — Épic 3). Ce fichier CONSOMME le contrat, il ne le définit pas : toute
 * évolution (champ ajouté/retiré, renommage, valeur d'enum) doit d'abord être décidée côté
 * contrat par l'orchestrateur, jamais improvisée ici.
 *
 * Fichier NEUF, volontairement séparé de `moderation.types.ts` (Épic 1/2 — file de
 * vérification + demandes d'urgence) : ce module ne le modifie pas, ne le touche pas, voir
 * périmètre de la tâche « candidatures ».
 */

// Réexportés depuis `features/profile/data/profile.types` : le contrat réutilise le même
// schéma `StudentProfile` (profil COMPLET, champs sensibles inclus) pour la vue modération
// d'une candidature (`ModerationApplication.student`) que pour la vue étudiant elle-même — ce
// module ne redéclare pas ces types, il les réexporte pour rester un point d'entrée pratique
// pour les composants « candidatures » (même pattern que `moderation.types.ts`).
export type { AvailabilitySlot, DayOfWeek, HousingSituation, OpportunityType, StudentProfile };

/**
 * `components.schemas.ApplicationStatus` — cycle de vie complet d'une candidature. Seul un
 * sous-ensemble (`pending_moderation`, `forwarded`, `rejected_moderation`) correspond à une
 * transition PILOTÉE par la modération ; les autres valeurs (`selected`, `accepted`,
 * `declined`, `rejected_by_recruiter`, `withdrawn`) sont pilotées par le recruteur/l'étudiant
 * après transmission, mais restent des valeurs valides du filtre `status` côté contrat.
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

/**
 * `components.schemas.ModerationApplication` — candidature enrichie pour la modération :
 * l'offre visée + le profil COMPLET de l'étudiant (champs sensibles inclus), pour juger
 * l'adéquation. Jamais servie au recruteur (voir CLAUDE.md — "le recruteur ne voit jamais les
 * profils étudiants bruts").
 */
export interface ModerationApplication {
  id: string;
  offer: OfferSummary;
  student: StudentProfile;
  status: ApplicationStatus;
  /** Message de motivation optionnel laissé par l'étudiant. */
  message: string | null;
  /** Motif renseigné uniquement lorsque `status = 'rejected_moderation'`. `null` sinon. */
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `components.schemas.ModerationApplicationPage` — page paginée de `ModerationApplication`. */
export interface ModerationApplicationPage {
  items: ModerationApplication[];
  page: number;
  pageSize: number;
  /** Nombre total de candidatures correspondant au filtre. */
  total: number;
}

/**
 * `components.schemas.ApplicationRejectRequest` — corps de
 * `POST /moderation/applications/{applicationId}/reject`.
 */
export interface ApplicationRejectRequest {
  /** Motif du rejet, communiqué à l'étudiant. Contrainte backend : 3 à 500 caractères. */
  reason: string;
}

/**
 * Paramètres de `GET /moderation/applications`. Défaut appliqué par le backend si `status` est
 * omis : `status = 'pending_moderation'` — distinct du défaut `status = 'pending'` de
 * `ModerationQueueParams` (file de vérification, `moderation.types.ts`), deux domaines/défauts
 * indépendants documentés séparément dans le contrat.
 */
export interface ModerationApplicationsQueueParams {
  status?: ApplicationStatus;
  page?: number;
  pageSize?: number;
}

/**
 * Codes machine (`ErrorResponse.error`) documentés par le contrat pour
 * `/moderation/applications/*` — à utiliser côté UI (ex. `switch`) : JAMAIS en parsant
 * `ErrorResponse.message`, qui est traduit (i18n) et donc instable pour de la logique.
 */
export type ModerationApplicationErrorCode = 'APPLICATION_NOT_FOUND' | 'APPLICATION_INVALID_STATE';

/**
 * `components.schemas.ErrorResponse` — format d'erreur générique partagé par toute l'API
 * `studentapi`, dérivé du type central `core/http/api-error.types.ts` avec `error` restreint
 * au sous-ensemble de codes métier propres à `/moderation/applications/*` pour permettre un
 * `switch`/narrowing sûr côté UI sur le corps d'un `HttpErrorResponse.error`.
 */
export type ModerationApplicationErrorResponse = Omit<ApiErrorResponse, 'error'> & {
  error: ModerationApplicationErrorCode;
};
