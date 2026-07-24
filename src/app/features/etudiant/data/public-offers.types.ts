import type { ApiErrorResponse } from '../../../core/http/api-error.types';
import type {
  AvailabilitySlot,
  DayOfWeek,
  OpportunityType,
} from '../../profile/data/profile.types';

/**
 * Types miroir du domaine `offers` du contrat d'API partagé `studentapi`
 * (`docs/openapi.yaml`, v0.4.0, tag `offers`, `components.schemas`). Ce fichier CONSOMME le
 * contrat, il ne le définit pas : toute évolution (champ ajouté/retiré, renommage, valeur
 * d'enum) doit d'abord être décidée côté contrat par l'orchestrateur, jamais improvisée ici.
 *
 * Périmètre : `/offers`, `/offers/{offerId}` — parcours des offres PUBLIÉES tel que vu par
 * l'étudiant. PAS `/moderation/*` ni les endpoints de gestion des offres côté recruteur, hors
 * périmètre de cette tâche.
 */

// Réexportés depuis `features/profile/data/profile.types` (Épic 2) : `OpportunityType` et
// `AvailabilitySlot` sont partagés par tout le domaine étudiant — ce module ne les redéclare
// pas, il les réexporte pour rester un point d'entrée pratique pour les consommateurs (écrans
// `features/etudiant/offres/**`) sans avoir à connaître le découpage exact des features.
export type { AvailabilitySlot, DayOfWeek, OpportunityType };

/** `components.schemas.RecruiterStructureType` — nature de la structure du recruteur. */
export type RecruiterStructureType =
  | 'entreprise'
  | 'commerce'
  | 'agence'
  | 'hotel'
  | 'restaurant'
  | 'ong'
  | 'particulier';

/**
 * `components.schemas.PublicRecruiter` — vue PUBLIQUE d'un recruteur, embarquée dans une
 * `PublicOffer`. N'expose ni contact personnel ni téléphone (dévoilés uniquement à la mise en
 * relation, voir `StudentApplication`/`accept` dans `applications.types.ts`).
 */
export interface PublicRecruiter {
  structureName: string;
  structureType: RecruiterStructureType;
  location: string;
  description?: string | null;
}

/**
 * `components.schemas.PublicOffer` — vue d'une offre PUBLIÉE telle que la voit un étudiant.
 * N'expose jamais le statut interne ni les compteurs du recruteur.
 */
export interface PublicOffer {
  id: string;
  title: string;
  description: string;
  opportunityType: OpportunityType;
  requiredSkills: string[];
  location: string;
  durationLabel: string;
  compensationLabel: string;
  availabilitySlots: AvailabilitySlot[];
  recruiter: PublicRecruiter;
  publishedAt: string;
}

/** `components.schemas.PublicOfferPage` — page paginée de `PublicOffer`. */
export interface PublicOfferPage {
  items: PublicOffer[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Paramètres de `GET /offers`. Filtres optionnels cumulables. Défauts appliqués par le
 * backend si omis : `page = 1`, `pageSize = 20` (max `pageSize = 100`).
 */
export interface PublicOfferListParams {
  opportunityType?: OpportunityType;
  skill?: string;
  location?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Codes machine (`ErrorResponse.error`) renvoyés par `/offers*` pour les cas d'erreur métier
 * documentés dans le contrat — à utiliser côté UI (ex. `switch` pour un message/action
 * localisé) : JAMAIS en parsant `ErrorResponse.message`, qui est traduit (i18n) et donc
 * instable pour de la logique.
 */
export type PublicOfferErrorCode = 'OFFER_NOT_FOUND';

/**
 * `components.schemas.ErrorResponse` — format d'erreur générique partagé par toute l'API
 * `studentapi`, dérivé du type central `core/http/api-error.types.ts` avec `error` restreint
 * au sous-ensemble de codes métier propres à `/offers*` pour permettre un `switch`/narrowing
 * sûr côté UI sur le corps d'un `HttpErrorResponse.error`.
 */
export type PublicOfferErrorResponse = Omit<ApiErrorResponse, 'error'> & {
  error: PublicOfferErrorCode;
};
