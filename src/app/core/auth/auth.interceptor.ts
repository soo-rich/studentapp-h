import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SessionService } from './session.service';

/**
 * Endpoints `/auth/*` qui ne doivent JAMAIS recevoir le header `Authorization` posé par cet
 * intercepteur : ce sont les endpoints publics du flux d'authentification lui-même (contrat
 * `studentapi` v0.2.0, tag `auth`) — `register`/`login` sont anonymes, `refresh` s'authentifie
 * via le refresh token dans le corps de la requête, jamais via Bearer.
 */
const PUBLIC_AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh'];

function isApiRequest(url: string): boolean {
  return url.startsWith(environment.apiBaseUrl);
}

function isPublicAuthEndpoint(url: string): boolean {
  return PUBLIC_AUTH_PATHS.some((path) => url === `${environment.apiBaseUrl}${path}`);
}

function withBearerToken(req: HttpRequest<unknown>, accessToken: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } });
}

/**
 * Intercepteur HTTP fonctionnel (FE3) :
 * - ajoute `Authorization: Bearer <accessToken>` aux requêtes dont l'URL cible
 *   `environment.apiBaseUrl` (jamais aux autres origines), sauf aux endpoints publics
 *   `/auth/login`, `/auth/register`, `/auth/refresh` ;
 * - sur une réponse `401` d'une requête API, tente UN SEUL renouvellement via
 *   `SessionService.refreshAccessToken()` :
 *   - succès -> rejoue la requête d'origine avec le nouveau token ;
 *   - échec -> vide la session (`SessionService.clear()`) et redirige vers `/`, puis
 *     propage l'erreur `401` d'origine.
 *
 * La requête rejouée passe directement par `next` (pas par cet intercepteur à nouveau,
 * puisque `next` représente la suite de la chaîne, hors l'intercepteur courant) : même si
 * elle échoue de nouveau avec un `401`, aucune deuxième tentative de refresh n'est
 * déclenchée — pas de boucle possible.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const sessionService = inject(SessionService);
  const router = inject(Router);

  if (!isApiRequest(req.url) || isPublicAuthEndpoint(req.url)) {
    return next(req);
  }

  const accessToken = sessionService.accessToken();
  const authorizedReq = accessToken !== null ? withBearerToken(req, accessToken) : req;

  return next(authorizedReq).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      return sessionService.refreshAccessToken().pipe(
        switchMap((refreshed) => {
          if (!refreshed) {
            sessionService.clear();
            void router.navigate(['/']);
            return throwError(() => error);
          }

          const newAccessToken = sessionService.accessToken();
          const retriedReq = newAccessToken !== null ? withBearerToken(req, newAccessToken) : req;

          return next(retriedReq);
        }),
      );
    }),
  );
};
