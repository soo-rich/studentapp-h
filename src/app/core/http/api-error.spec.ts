import { HttpErrorResponse } from '@angular/common/http';

import {
  extractErrorCode,
  extractErrorMessage,
  GENERIC_ERROR_MESSAGE,
  isApiErrorBody,
} from './api-error';
import { ApiErrorResponse } from './api-error.types';

/** Corps `ErrorResponse` conforme au contrat, réutilisé par plusieurs cas de test. */
const conformBody: ApiErrorResponse = {
  statusCode: 404,
  error: 'PROFILE_NOT_FOUND',
  message: 'Profil introuvable.',
  timestamp: '2026-07-16T00:00:00.000Z',
  path: '/students/me/profile',
};

describe('isApiErrorBody', () => {
  it('accepts a body with a string message, even without the other ErrorResponse fields', () => {
    expect(isApiErrorBody({ message: 'oops' })).toBe(true);
  });

  it('accepts a full conform ErrorResponse body', () => {
    expect(isApiErrorBody(conformBody)).toBe(true);
  });

  it('rejects null', () => {
    expect(isApiErrorBody(null)).toBe(false);
  });

  it('rejects a non-object value', () => {
    expect(isApiErrorBody('just a string')).toBe(false);
  });

  it('rejects an object whose message is not a string', () => {
    expect(isApiErrorBody({ message: 42 })).toBe(false);
  });

  it('rejects an object with no message at all', () => {
    expect(isApiErrorBody({ error: 'SOMETHING' })).toBe(false);
  });
});

describe('extractErrorMessage', () => {
  it('returns the translated ErrorResponse.message from a conform HttpErrorResponse', () => {
    const error = new HttpErrorResponse({ status: 404, error: conformBody });

    expect(extractErrorMessage(error)).toBe('Profil introuvable.');
  });

  it('falls back to the generic message for a plain Error (non-HTTP failure)', () => {
    const error = new Error('network down');

    expect(extractErrorMessage(error)).toBe(GENERIC_ERROR_MESSAGE);
  });

  it('falls back to the generic message when the HttpErrorResponse body is null', () => {
    const error = new HttpErrorResponse({ status: 502, error: null });

    expect(extractErrorMessage(error)).toBe(GENERIC_ERROR_MESSAGE);
  });

  it('falls back to the generic message when the body message is not a string', () => {
    const error = new HttpErrorResponse({ status: 500, error: { message: 12345 } });

    expect(extractErrorMessage(error)).toBe(GENERIC_ERROR_MESSAGE);
  });

  it('returns exactly the accented generic message string relied upon by other screens', () => {
    expect(GENERIC_ERROR_MESSAGE).toBe('Une erreur est survenue. Réessaie dans un instant.');
  });

  it('does not leak the body of an Error-like object that is not a real HttpErrorResponse', () => {
    // Ancrage de la garde `instanceof HttpErrorResponse`. Sans elle, le `.error.message` de
    // n'importe quel objet Error-like fuiterait tel quel à l'écran (erreur enrichie par un
    // intercepteur maison, mock dupliqué entre réalms de test…). Retirer la garde doit rougir ici.
    const trapError = Object.assign(new Error('erreur interne'), {
      error: { message: 'Détail technique interne qui ne doit jamais être affiché.' },
    });

    expect(extractErrorMessage(trapError)).toBe(GENERIC_ERROR_MESSAGE);
  });
});

describe('extractErrorCode', () => {
  it('returns the machine code from a conform HttpErrorResponse body', () => {
    const error = new HttpErrorResponse({ status: 404, error: conformBody });

    expect(extractErrorCode(error)).toBe('PROFILE_NOT_FOUND');
  });

  it('returns null when the body has no `error` field', () => {
    const error = new HttpErrorResponse({
      status: 401,
      error: { message: 'Identifiants invalides.' },
    });

    expect(extractErrorCode(error)).toBeNull();
  });

  it('returns null for a plain Error (non-HTTP failure)', () => {
    const error = new Error('network down');

    expect(extractErrorCode(error)).toBeNull();
  });

  it('returns null when the HttpErrorResponse body is null', () => {
    const error = new HttpErrorResponse({ status: 502, error: null });

    expect(extractErrorCode(error)).toBeNull();
  });

  it('returns null when the `error` field is present but not a string', () => {
    const error = new HttpErrorResponse({
      status: 500,
      error: { message: 'oops', error: 123 },
    });

    expect(extractErrorCode(error)).toBeNull();
  });

  it('does not read the machine code of an Error-like object that is not a real HttpErrorResponse', () => {
    // Même ancrage que pour `extractErrorMessage` : un code métier ne doit jamais être tiré d'un
    // objet qui n'est pas une vraie réponse HTTP, sous peine de router de la logique sur du faux.
    const trapError = Object.assign(new Error('erreur interne'), {
      error: { message: 'oops', error: 'FAKE_CODE' },
    });

    expect(extractErrorCode(trapError)).toBeNull();
  });
});
