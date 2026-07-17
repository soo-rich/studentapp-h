import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { SessionService } from './core/auth/session.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAnimationsAsync(),
    // `authInterceptor` (FE3) ajoute le Bearer aux appels API et gère le refresh
    // automatique sur 401 — voir `core/auth/auth.interceptor.ts`.
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    // Client TanStack Query unique pour toute l'app : tout appel API doit passer par les
    // query/mutation exposées dans `core/**/*.queries.ts` (voir CLAUDE.md), jamais par un
    // appel HttpClient direct dans un composant.
    provideTanStackQuery(new QueryClient()),
    // Restaure la session (refresh token persisté -> nouvel access token -> utilisateur
    // courant) avant que l'app ne devienne interactive — voir
    // `SessionService.restoreSession()` (FE3).
    provideAppInitializer(() => inject(SessionService).restoreSession()),
  ],
};
