import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(withFetch()),
    // Client TanStack Query unique pour toute l'app : tout appel API doit passer par les
    // query/mutation exposées dans `core/**/*.queries.ts` (voir CLAUDE.md), jamais par un
    // appel HttpClient direct dans un composant.
    provideTanStackQuery(new QueryClient()),
  ],
};
