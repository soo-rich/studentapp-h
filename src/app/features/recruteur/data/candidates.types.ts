import { ApiErrorResponse } from '../../../core/http/api-error.types';
import type { AvailabilitySlot, OpportunityType } from '../../profile/data/profile.types';

/**
 * Types miroir du domaine `candidates` du contrat d'API partagé `studentapi`
 * (`docs/openapi.yaml`, v0.4.0, tag `offers`, sous-ressource
 * `/recruiters/me/offers/{offerId}/candidates*`, `components.schemas`). Ce fichier CONSOMME
 * le contrat, il ne le définit pas : toute évolution (champ ajouté/retiré, renommage, valeur
 * d'enum) doit d'abord être décidée côté contrat par l'orchestrateur, jamais improvisée ici.
 *
 * IMPORTANT (voir CLAUDE.md — "le recruteur ne voit jamais les profils étudiants bruts") :
 * `CandidateCard` est une fiche ANONYME. Elle n'expose JAMAIS nom, prénom, téléphone, numéro
 * de carte étudiant, e-mail, identifiant utilisateur, ni aucun champ sensible (logement,
 * handicap, allergies). L'identité et le contact ne se récupèrent qu'après accord explicite
 * de l'étudiant (`status = 'accepted'`), via `CandidateContact` (`.../contact`) — le SEUL
 * point du contrat qui expose l'identité d'un étudiant à un recruteur.
 */

// Réexportés depuis `features/profile/data/profile.types` : le domaine `candidates` du contrat
// partage ces mêmes schémas — ce module ne les redéclare pas, il les réexporte pour rester un
// point d'entrée pratique pour les consommateurs (composants `features/recruteur`).
export type { AvailabilitySlot, OpportunityType };

/**
 * `components.schemas.CandidateVisibleStatus` — sous-ensemble d'`ApplicationStatus` visible
 * du recruteur (une candidature ne lui est jamais montrée avant `forwarded`). Sert de filtre
 * sur la liste des candidats.
 */
export type CandidateVisibleStatus =
  | 'forwarded'
  | 'selected'
  | 'accepted'
  | 'declined'
  | 'rejected_by_recruiter';

/**
 * `components.schemas.CandidateCard` — fiche candidat ANONYME, seule vue d'un étudiant
 * accessible au recruteur.
 */
export interface CandidateCard {
  /** Identifiant de la candidature, utilisé pour sélectionner ce candidat. */
  applicationId: string;
  status: CandidateVisibleStatus;
  university: string;
  fieldOfStudy: string;
  studyLevel: string;
  skills: string[];
  languages: string[];
  experiences?: string | null;
  opportunityTypes: OpportunityType[];
  availabilitySlots: AvailabilitySlot[];
  /**
   * Zone de résidence déclarée par l'étudiant (quartier / ville). Volontairement
   * approximative : jamais une adresse précise.
   */
  residenceArea: string;
}

/** `components.schemas.CandidateCardPage` — page paginée de `CandidateCard`. */
export interface CandidateCardPage {
  items: CandidateCard[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * `components.schemas.CandidateContact` — coordonnées d'un candidat, dévoilées au recruteur
 * UNIQUEMENT après acceptation de l'étudiant (`status = 'accepted'`).
 */
export interface CandidateContact {
  firstName: string;
  lastName: string;
  /** Numéro déclaré par l'étudiant. `null` s'il n'en a pas renseigné. */
  phoneNumber: string | null;
}

/**
 * Paramètres de `GET /recruiters/me/offers/{offerId}/candidates`. Défauts appliqués par le
 * backend si omis : `page = 1`, `pageSize = 20` (max `pageSize = 100`). Pas de filtre
 * `status` par défaut (tous les statuts visibles du recruteur sont renvoyés si omis).
 */
export interface CandidateQueueParams {
  status?: CandidateVisibleStatus;
  page?: number;
  pageSize?: number;
}

/**
 * Codes machine (`ErrorResponse.error`) renvoyés par les endpoints
 * `/recruiters/me/offers/{offerId}/candidates*` pour les cas d'erreur métier documentés dans
 * le contrat — à utiliser côté UI (ex. `switch` pour un message/action localisé) : JAMAIS en
 * parsant `ErrorResponse.message`, qui est traduit (i18n) et donc instable pour de la logique.
 */
export type CandidateErrorCode =
  | 'OFFER_NOT_FOUND'
  | 'APPLICATION_NOT_FOUND'
  | 'APPLICATION_INVALID_STATE'
  /** Renvoyé par `GET .../contact` tant que le candidat n'a pas (encore) accepté. */
  | 'CANDIDATE_CONTACT_NOT_AVAILABLE';

/**
 * `components.schemas.ErrorResponse` — format d'erreur générique partagé par toute l'API
 * `studentapi`, dérivé du type central `core/http/api-error.types.ts` avec `error` restreint
 * au sous-ensemble de codes métier propres aux endpoints candidats pour permettre un
 * `switch`/narrowing sûr côté UI sur le corps d'un `HttpErrorResponse.error`.
 */
export type CandidateErrorResponse = Omit<ApiErrorResponse, 'error'> & {
  error: CandidateErrorCode;
};
