import { ApiErrorResponse } from '../../../core/http/api-error.types';

/**
 * Types miroir du domaine `profile` du contrat d'API partagé `studentapi`
 * (`docs/openapi.yaml`, v0.3.0, tag `profile`, `components.schemas`). Ce fichier CONSOMME le
 * contrat, il ne le définit pas : toute évolution (champ ajouté/retiré, renommage, valeur
 * d'enum) doit d'abord être décidée côté contrat par l'orchestrateur, jamais improvisée ici.
 *
 * Périmètre : `/students/me/profile` (profil détaillé de l'étudiant courant). PAS
 * `/students/me/urgent-request` (demandes d'urgence, hors périmètre de cette tâche) ni
 * `/moderation/students/{userId}/profile` (vue modération, réservé au rôle `moderateur`).
 *
 * Note — le front étudiant voit son PROPRE profil COMPLET, champs sensibles inclus
 * (`housingSituation`, `hasDisability`, `disabilityDescription`, `allergies`) : ce n'est PAS
 * une vue restreinte comme celle qui sera un jour exposée au recruteur (DTO distinct à créer
 * hors périmètre, voir description `StudentProfile` dans le contrat).
 */

/** `components.schemas.OpportunityType` — type d'opportunité recherchée par l'étudiant. */
export type OpportunityType = 'temps_partiel' | 'mission_ponctuelle' | 'job_vacances' | 'stage';

/**
 * `components.schemas.HousingSituation`. Champ SENSIBLE. Situation de logement de
 * l'étudiant. Jamais exposé au recruteur.
 */
export type HousingSituation = 'seul' | 'avec_parents_tuteurs';

/** `components.schemas.DayOfWeek`. */
export type DayOfWeek =
  'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi' | 'samedi' | 'dimanche';

/**
 * `components.schemas.AvailabilitySlot` — créneau de disponibilité (heures libres pour
 * travailler) sur une journée type de la semaine. Exploité par le matching (Épic 5).
 * `startTime`/`endTime` au format 24h `HH:mm`, `startTime` < `endTime`.
 */
export interface AvailabilitySlot {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

/**
 * `components.schemas.StudentProfile` — profil détaillé d'un étudiant. Vue COMPLÈTE réservée
 * à l'étudiant lui-même et à la modération : elle inclut les champs sensibles
 * (`housingSituation`, `hasDisability`, `disabilityDescription`, `allergies`). Une éventuelle
 * vue recruteur (Épic 5) devra passer par un DTO distinct qui n'inclut JAMAIS ces champs
 * sensibles.
 */
export interface StudentProfile {
  userId: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
  university: string;
  studentCardNumber: string;
  /** Filière (texte libre). */
  fieldOfStudy: string;
  /** Niveau d'étude (texte libre, ex. « Licence 3 », « Master 1 »). */
  studyLevel: string;
  skills: string[];
  /** Expériences professionnelles éventuelles (texte libre). */
  experiences?: string | null;
  languages: string[];
  /** Lieu de résidence (quartier / ville). */
  residenceLocation: string;
  opportunityTypes: OpportunityType[];
  availabilitySlots: AvailabilitySlot[];
  /** SENSIBLE. Renseigné uniquement si consentement donné. */
  housingSituation?: HousingSituation | null;
  /** SENSIBLE. Renseigné uniquement si consentement donné. */
  hasDisability?: boolean | null;
  /** SENSIBLE. Précision libre lorsque `hasDisability` est vrai. */
  disabilityDescription?: string | null;
  /** SENSIBLE. Texte libre, renseigné uniquement si consentement donné. */
  allergies?: string | null;
  /**
   * Consentement explicite de l'étudiant à la collecte des champs sensibles. `false` tant
   * qu'il n'a pas consenti (les champs sensibles sont alors `null`).
   */
  sensitiveDataConsent: boolean;
  /** Horodatage du consentement, `null` si jamais consenti. */
  sensitiveDataConsentAt?: string | null;
  updatedAt: string;
}

/**
 * `components.schemas.StudentProfileUpsertRequest` — corps de `PUT /students/me/profile`
 * (upsert). Les champs sensibles (`housingSituation`, `hasDisability`,
 * `disabilityDescription`, `allergies`) ne sont acceptés que si `sensitiveDataConsent` vaut
 * `true` — sinon 422 `PROFILE_SENSITIVE_CONSENT_REQUIRED`.
 */
export interface StudentProfileUpsertRequest {
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
  university: string;
  studentCardNumber: string;
  fieldOfStudy: string;
  studyLevel: string;
  /** Défaut `[]` côté contrat si omis. */
  skills?: string[];
  experiences?: string | null;
  /** Défaut `[]` côté contrat si omis. */
  languages?: string[];
  residenceLocation: string;
  opportunityTypes: OpportunityType[];
  /** Défaut `[]` côté contrat si omis. */
  availabilitySlots?: AvailabilitySlot[];
  /**
   * Doit valoir `true` pour que les champs sensibles ci-dessous soient acceptés et stockés.
   * S'il repasse à `false`, les champs sensibles sont effacés. Défaut `false` côté contrat.
   */
  sensitiveDataConsent?: boolean;
  housingSituation?: HousingSituation | null;
  hasDisability?: boolean | null;
  disabilityDescription?: string | null;
  allergies?: string | null;
}

/**
 * Codes machine (`ErrorResponse.error`) renvoyés par `/students/me/profile` pour les cas
 * d'erreur métier documentés dans le contrat — à utiliser côté UI (ex. `switch` pour un
 * message/action localisé) : JAMAIS en parsant `ErrorResponse.message`, qui est traduit
 * (i18n) et donc instable pour de la logique.
 */
export type ProfileErrorCode = 'PROFILE_NOT_FOUND' | 'PROFILE_SENSITIVE_CONSENT_REQUIRED';

/**
 * `components.schemas.ErrorResponse` — format d'erreur générique partagé par toute l'API
 * `studentapi`, dérivé du type central `core/http/api-error.types.ts` avec `error` restreint
 * au sous-ensemble de codes métier propres à `/students/me/profile` pour permettre un
 * `switch`/narrowing sûr côté UI sur le corps d'un `HttpErrorResponse.error`.
 */
export type ProfileErrorResponse = Omit<ApiErrorResponse, 'error'> & { error: ProfileErrorCode };
