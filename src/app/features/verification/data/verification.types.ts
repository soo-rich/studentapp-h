/**
 * Types miroir du domaine `verification` du contrat d'API partagé `studentapi`
 * (`docs/openapi.yaml`, v0.2.0, tag `verification`, `components.schemas`). Ce fichier CONSOMME
 * le contrat, il ne le définit pas : toute évolution (champ ajouté/retiré, renommage, valeur
 * d'enum) doit d'abord être décidée côté contrat par l'orchestrateur, jamais improvisée ici.
 *
 * Périmètre : `/verification/documents*` (documents de l'utilisateur courant). PAS
 * `/moderation/*` (file de modération, réservé au rôle `moderateur` — hors périmètre de cette
 * tâche, voir FE14+).
 */

/**
 * `components.schemas.DocumentType`. Contraint par le rôle côté backend — rejeté en 422
 * `VERIFICATION_DOCUMENT_INVALID_TYPE` sinon :
 * - étudiant -> `carte_etudiant` | `certificat_scolarite`
 * - recruteur -> `piece_identite` | `justificatif_structure`
 */
export type DocumentType =
  'carte_etudiant' | 'certificat_scolarite' | 'piece_identite' | 'justificatif_structure';

/**
 * `components.schemas.VerificationDocument` — métadonnées d'un document de vérification.
 * Ne contient jamais le binaire ni la clé de stockage interne (le contenu n'est récupérable
 * que via `/moderation/documents/{documentId}/content`, rôle moderateur uniquement).
 */
export interface VerificationDocument {
  id: string;
  type: DocumentType;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

/**
 * Codes machine (`ErrorResponse.error`) renvoyés par les endpoints `/verification/documents*`
 * pour les cas d'erreur métier documentés dans le contrat — à utiliser côté UI (ex. `switch`
 * pour un message/action localisé) : JAMAIS en parsant `ErrorResponse.message`, qui est traduit
 * (i18n) et donc instable pour de la logique.
 */
export type VerificationErrorCode =
  | 'VERIFICATION_ALREADY_VERIFIED'
  | 'VERIFICATION_FILE_TOO_LARGE'
  | 'VERIFICATION_UNSUPPORTED_MEDIA_TYPE'
  | 'VERIFICATION_DOCUMENT_INVALID_TYPE'
  | 'VERIFICATION_DOCUMENT_NOT_FOUND';

/**
 * `components.schemas.ErrorResponse` — format d'erreur générique partagé par toute l'API
 * `studentapi`. Pas encore hébergé dans un module `core/http` commun (aucun n'existe dans ce
 * repo à ce jour, et sa création est hors périmètre de cette tâche) : redéfini ici localement,
 * avec `error` restreint au sous-ensemble de codes métier propres à `/verification/documents*`
 * pour permettre un `switch`/narrowing sûr côté UI (FE11) sur le corps d'un
 * `HttpErrorResponse.error`.
 */
export interface VerificationErrorResponse {
  statusCode: number;
  error: VerificationErrorCode;
  message: string;
  timestamp: string;
  path: string;
}
