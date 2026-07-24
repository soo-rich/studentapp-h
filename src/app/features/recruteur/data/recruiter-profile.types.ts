import { ApiErrorResponse } from '../../../core/http/api-error.types';

/**
 * Types miroir du domaine `recruiter-profile` du contrat d'API partagé `studentapi`
 * (`docs/openapi.yaml`, v0.4.0, tag `recruiter-profile`, `components.schemas`). Ce fichier
 * CONSOMME le contrat, il ne le définit pas : toute évolution (champ ajouté/retiré,
 * renommage, valeur d'enum) doit d'abord être décidée côté contrat par l'orchestrateur,
 * jamais improvisée ici.
 *
 * Périmètre : `/recruiters/me/profile` (profil de structure du recruteur courant).
 */

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
 * `components.schemas.RecruiterProfile` — profil de la structure d'un recruteur, vu par le
 * recruteur lui-même.
 */
export interface RecruiterProfile {
  userId: string;
  structureName: string;
  structureType: RecruiterStructureType;
  contactFirstName: string;
  contactLastName: string;
  phoneNumber: string;
  /** Localisation de la structure (quartier / ville). */
  location: string;
  /** Présentation libre de la structure. */
  description?: string | null;
  updatedAt: string;
}

/**
 * `components.schemas.RecruiterProfileUpsertRequest` — corps de `PUT /recruiters/me/profile`
 * (upsert idempotent).
 */
export interface RecruiterProfileUpsertRequest {
  structureName: string;
  structureType: RecruiterStructureType;
  contactFirstName: string;
  contactLastName: string;
  phoneNumber: string;
  location: string;
  description?: string | null;
}

/**
 * Codes machine (`ErrorResponse.error`) renvoyés par `/recruiters/me/profile` pour les cas
 * d'erreur métier documentés dans le contrat — à utiliser côté UI (ex. `switch` pour un
 * message/action localisé) : JAMAIS en parsant `ErrorResponse.message`, qui est traduit
 * (i18n) et donc instable pour de la logique.
 */
export type RecruiterProfileErrorCode = 'RECRUITER_PROFILE_NOT_FOUND';

/**
 * `components.schemas.ErrorResponse` — format d'erreur générique partagé par toute l'API
 * `studentapi`, dérivé du type central `core/http/api-error.types.ts` avec `error` restreint
 * au sous-ensemble de codes métier propres à `/recruiters/me/profile` pour permettre un
 * `switch`/narrowing sûr côté UI sur le corps d'un `HttpErrorResponse.error`.
 */
export type RecruiterProfileErrorResponse = Omit<ApiErrorResponse, 'error'> & {
  error: RecruiterProfileErrorCode;
};
