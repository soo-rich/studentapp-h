import { HttpErrorResponse } from '@angular/common/http';

import { PartialApiErrorBody } from './api-error.types';

/**
 * Message générique affiché quand le corps d'erreur est inexploitable (panne réseau, page
 * d'erreur HTML d'un proxy, corps sans `message`…). Chaîne stable — des tests en dépendent.
 */
export const GENERIC_ERROR_MESSAGE = 'Une erreur est survenue. Réessaie dans un instant.';

/**
 * Garde de type sur un corps d'erreur `unknown` (ex. `HttpErrorResponse.error`) : ne garantit
 * que la présence d'un `message` de type `string`, seul champ qu'on peut réellement attendre
 * d'un corps qui n'est pas forcément produit par l'API `studentapi` (voir `PartialApiErrorBody`).
 */
export function isApiErrorBody(value: unknown): value is PartialApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { message?: unknown }).message === 'string'
  );
}

/** Message traduit renvoyé par l'API, ou message générique si le corps est inexploitable. */
export function extractErrorMessage(error: Error): string {
  if (error instanceof HttpErrorResponse && isApiErrorBody(error.error)) {
    return error.error.message;
  }
  return GENERIC_ERROR_MESSAGE;
}

/** Code machine `error` du corps, ou null s'il est absent/inexploitable. */
export function extractErrorCode<TCode extends string = string>(error: Error): TCode | null {
  if (
    error instanceof HttpErrorResponse &&
    isApiErrorBody(error.error) &&
    typeof error.error.error === 'string'
  ) {
    return error.error.error as TCode;
  }
  return null;
}
