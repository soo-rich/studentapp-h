import { ApiErrorResponse } from '../../../core/http/api-error.types';
import type { AvailabilitySlot, OpportunityType } from '../../profile/data/profile.types';

/**
 * Types miroir du domaine `offers` du contrat d'API partagé `studentapi`
 * (`docs/openapi.yaml`, v0.4.0, tag `offers`, `components.schemas`). Ce fichier CONSOMME le
 * contrat, il ne le définit pas : toute évolution (champ ajouté/retiré, renommage, valeur
 * d'enum) doit d'abord être décidée côté contrat par l'orchestrateur, jamais improvisée ici.
 *
 * Périmètre : `/recruiters/me/offers*` (offres du recruteur courant — création, édition,
 * publication, fermeture). PAS `/offers/{offerId}` public (vue étudiant, hors périmètre) ni
 * `/recruiters/me/offers/{offerId}/candidates*` (domaine `candidates.types.ts` distinct).
 */

// Réexportés depuis `features/profile/data/profile.types` : le domaine `offers` du contrat
// partage ces mêmes schémas — ce module ne les redéclare pas, il les réexporte pour rester un
// point d'entrée pratique pour les consommateurs (composants `features/recruteur`).
export type { AvailabilitySlot, OpportunityType };

/**
 * `components.schemas.OfferStatus`. `draft` : brouillon, visible du seul recruteur.
 * `published` : visible des étudiants, ouverte aux candidatures. `closed` : retirée, n'accepte
 * plus de candidature.
 */
export type OfferStatus = 'draft' | 'published' | 'closed';

/**
 * `components.schemas.Offer` — offre vue par le recruteur qui la détient (inclut le statut et
 * le nombre de candidats transmis).
 */
export interface Offer {
  id: string;
  title: string;
  description: string;
  opportunityType: OpportunityType;
  requiredSkills: string[];
  location: string;
  /** Durée en texte libre (ex. « 2 semaines », « 3 mois »). */
  durationLabel: string;
  /** Rémunération ou indemnité de stage, en texte libre. */
  compensationLabel: string;
  /** Créneaux de travail attendus (exploités par le matching, Épic 5). */
  availabilitySlots: AvailabilitySlot[];
  status: OfferStatus;
  /** Nombre de candidats validés par la modération et transmis pour cette offre. Lecture seule. */
  forwardedCandidatesCount: number;
  /** Date de publication, `null` tant que l'offre est en brouillon. */
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `components.schemas.OfferPage` — page paginée de `Offer`. */
export interface OfferPage {
  items: Offer[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * `components.schemas.OfferCreateRequest` — corps de `POST /recruiters/me/offers`. L'offre
 * est créée au statut `draft`.
 */
export interface OfferCreateRequest {
  title: string;
  description: string;
  opportunityType: OpportunityType;
  /** Défaut `[]` côté contrat si omis. */
  requiredSkills?: string[];
  location: string;
  durationLabel: string;
  compensationLabel: string;
  /** Défaut `[]` côté contrat si omis. */
  availabilitySlots?: AvailabilitySlot[];
}

/**
 * `components.schemas.OfferUpdateRequest` — corps de `PATCH /recruiters/me/offers/{offerId}`.
 * Mêmes champs que la création (le statut se change via les endpoints d'action
 * `publish`/`close`, pas ici). Édition autorisée uniquement tant que l'offre est en `draft`.
 */
export type OfferUpdateRequest = OfferCreateRequest;

/**
 * Paramètres de `GET /recruiters/me/offers`. Défauts appliqués par le backend si omis :
 * `page = 1`, `pageSize = 20` (max `pageSize = 100`). Pas de filtre `status` par défaut
 * (toutes les offres du recruteur sont renvoyées si omis).
 */
export interface OfferQueueParams {
  status?: OfferStatus;
  page?: number;
  pageSize?: number;
}

/**
 * Codes machine (`ErrorResponse.error`) renvoyés par les endpoints `/recruiters/me/offers*`
 * pour les cas d'erreur métier documentés dans le contrat — à utiliser côté UI (ex. `switch`
 * pour un message/action localisé) : JAMAIS en parsant `ErrorResponse.message`, qui est
 * traduit (i18n) et donc instable pour de la logique.
 */
export type OfferErrorCode =
  | 'OFFER_NOT_FOUND'
  | 'OFFER_NOT_EDITABLE'
  | 'OFFER_INVALID_STATE'
  /** Renvoyé par `POST /recruiters/me/offers` si aucun profil recruteur n'existe encore. */
  | 'RECRUITER_PROFILE_REQUIRED';

/**
 * `components.schemas.ErrorResponse` — format d'erreur générique partagé par toute l'API
 * `studentapi`, dérivé du type central `core/http/api-error.types.ts` avec `error` restreint
 * au sous-ensemble de codes métier propres à `/recruiters/me/offers*` pour permettre un
 * `switch`/narrowing sûr côté UI sur le corps d'un `HttpErrorResponse.error`.
 */
export type OfferErrorResponse = Omit<ApiErrorResponse, 'error'> & { error: OfferErrorCode };
