/**
 * Types miroir du domaine `urgent-request` du contrat d'API partagé `studentapi`
 * (`docs/openapi.yaml`, v0.3.0, tag `profile`, `components.schemas`). Ce fichier CONSOMME
 * le contrat, il ne le définit pas : toute évolution (champ ajouté/retiré, renommage, valeur
 * d'enum) doit d'abord être décidée côté contrat par l'orchestrateur, jamais improvisée ici.
 *
 * Périmètre : `/students/me/urgent-request` (demande d'urgence de l'utilisateur COURANT, rôle
 * `etudiant`). PAS `/moderation/urgent-requests*` (file de traitement, réservée au rôle
 * `moderateur` — hors périmètre de cette tâche).
 */

/**
 * `components.schemas.UrgentRequestStatus`. `pending` : en attente de traitement.
 * `prioritized` : classée en priorité par la modération. `dismissed` : écartée après examen.
 */
export type UrgentRequestStatus = 'pending' | 'prioritized' | 'dismissed';

/**
 * `components.schemas.UrgentRequest` — demande d'urgence, vue de l'étudiant qui l'a déposée.
 * Message privé de détresse examiné par l'équipe de modération (voir CLAUDE.md — option
 * "urgence" du parcours étudiant).
 */
export interface UrgentRequest {
  id: string;
  status: UrgentRequestStatus;
  message: string;
  /** Note laissée par la modération lors du traitement, `null` sinon. */
  moderatorNote: string | null;
  createdAt: string;
  /** Date de traitement, `null` tant que `pending`. */
  reviewedAt: string | null;
}

/**
 * `components.schemas.UrgentRequestCreateRequest` — corps de
 * `POST /students/me/urgent-request`. Contrainte backend : `message` entre 10 et 1000
 * caractères, sinon 422.
 */
export interface UrgentRequestCreateRequest {
  message: string;
}

/**
 * Codes machine (`ErrorResponse.error`) renvoyés par `/students/me/urgent-request` pour les cas
 * d'erreur métier documentés dans le contrat — à utiliser côté UI (ex. `switch` pour un
 * message/action localisé) : JAMAIS en parsant `ErrorResponse.message`, qui est traduit (i18n)
 * et donc instable pour de la logique.
 *
 * `URGENT_REQUEST_NOT_FOUND` (404 sur le `GET`) est un cas métier NORMAL — aucune demande
 * d'urgence en cours, PAS une panne applicative — voir le commentaire de
 * `injectUrgentRequestQuery` dans `urgent-request.queries.ts`.
 */
export type UrgentRequestErrorCode =
  | 'URGENT_REQUEST_NOT_FOUND'
  | 'URGENT_REQUEST_ALREADY_PENDING';

/**
 * `components.schemas.ErrorResponse` — format d'erreur générique partagé par toute l'API
 * `studentapi`. Pas encore hébergé dans un module `core/http` commun (aucun n'existe dans ce
 * repo à ce jour, et sa création est hors périmètre de cette tâche) : redéfini ici localement,
 * avec `error` restreint au sous-ensemble de codes métier propres à
 * `/students/me/urgent-request` pour permettre un `switch`/narrowing sûr côté UI sur le corps
 * d'un `HttpErrorResponse.error`.
 */
export interface UrgentRequestErrorResponse {
  statusCode: number;
  error: UrgentRequestErrorCode;
  message: string;
  timestamp: string;
  path: string;
}
