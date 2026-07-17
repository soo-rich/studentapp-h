import { inject } from '@angular/core';
import { injectMutation, injectQuery } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';

import { AuthApiService } from './auth-api.service';
import { authKeys } from './auth.keys';
import { AuthResponse, LoginRequest, RegisterRequest, User } from './auth.types';

/**
 * Composables TanStack Query pour le domaine `/auth/*`. Chaque fonction `inject*` doit
 * être appelée dans un contexte d'injection (constructeur/champ de composant, ou un autre
 * composable appelé depuis un tel contexte) — même contrainte que `injectQuery`/
 * `injectMutation` eux-mêmes. Elles encapsulent `AuthApiService` (accès HTTP brut) derrière
 * le pattern query/mutation attendu par le projet (voir CLAUDE.md — "tout appel API passe
 * par TanStack Query").
 *
 * NOTE — FE3 : `SessionService` consommera ces composables pour piloter le state d'auth
 * réel (stockage des tokens, `currentRole`, refresh automatique, invalidation de
 * `authKeys.me()` après login/logout). Rien ici ne persiste de token : `logout`/`me`
 * reçoivent l'access token en variable de mutation ou via un accesseur réactif.
 */

/** `POST /auth/register` — crée le compte, retourne `AuthResponse` (user + tokens). */
export function injectRegisterMutation() {
  const authApi = inject(AuthApiService);

  return injectMutation(() => ({
    mutationFn: (payload: RegisterRequest): Promise<AuthResponse> =>
      firstValueFrom(authApi.register(payload)),
  }));
}

/** `POST /auth/login` — retourne `AuthResponse` (user + tokens). */
export function injectLoginMutation() {
  const authApi = inject(AuthApiService);

  return injectMutation(() => ({
    mutationFn: (payload: LoginRequest): Promise<AuthResponse> =>
      firstValueFrom(authApi.login(payload)),
  }));
}

/**
 * `POST /auth/logout` — variable de mutation = l'access token courant (fourni par
 * l'appelant, typiquement `SessionService` en FE3).
 */
export function injectLogoutMutation() {
  const authApi = inject(AuthApiService);

  return injectMutation(() => ({
    mutationFn: (accessToken: string): Promise<void> => firstValueFrom(authApi.logout(accessToken)),
  }));
}

/**
 * `GET /auth/me` — `accessToken` est un accesseur réactif (ex. signal) : la query est
 * automatiquement désactivée (`enabled: false`) tant qu'aucun token n'est disponible, et se
 * réexécute si l'accesseur change de valeur (même mécanique que `injectQuery` avec un
 * signal, voir doc TanStack Angular Query).
 */
export function injectMeQuery(accessToken: () => string | null) {
  const authApi = inject(AuthApiService);

  return injectQuery(() => {
    const token = accessToken();

    return {
      queryKey: authKeys.me(),
      queryFn: (): Promise<User> => firstValueFrom(authApi.me(token as string)),
      enabled: token !== null,
    };
  });
}

// `POST /auth/refresh` n'est volontairement PAS exposé en query/mutation ici : c'est un
// renouvellement de token en arrière-plan, déclenché par l'intercepteur Bearer/refresh
// automatique de FE3 (pas une mutation pilotée par l'UI). `AuthApiService.refresh` reste
// disponible pour cet usage.
