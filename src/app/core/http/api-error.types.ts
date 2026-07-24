/**
 * Format d'erreur standard de l'API — schéma `ErrorResponse` de
 * `studentapi/docs/openapi.yaml`. Les 5 champs y sont requis.
 * `error` est un code machine stable : c'est LUI qu'on teste en logique front,
 * jamais `message` (traduit, destiné à l'affichage).
 */
export interface ApiErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  timestamp: string;
  path: string;
}

/**
 * Ce qu'on peut réellement garantir à l'exécution : un corps d'erreur qui n'est
 * pas forcément produit par l'API (502 d'un proxy, page HTML d'erreur…) peut
 * n'avoir que `message`. La garde ne promet donc que ce champ.
 */
export type PartialApiErrorBody = Partial<ApiErrorResponse> & { message: string };
