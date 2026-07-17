import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, switchMap, tap } from 'rxjs';

import { AuthApiService } from './auth-api.service';
import { AuthResponse, AuthTokens, User } from './auth.types';
import { Role } from './role';

/**
 * Clé `localStorage` du refresh token — seule donnée de session persistée (décision de
 * stockage imposée, FE3) : `accessToken` reste UNIQUEMENT en mémoire (signal), jamais
 * écrit sur disque.
 */
export const REFRESH_TOKEN_STORAGE_KEY = 'studentapp.auth.refreshToken';

/**
 * État de session réel (FE3) : consomme `AuthApiService` (FE2, `/auth/register`,
 * `/auth/login`, `/auth/refresh`, `/auth/me`) pour piloter l'authentification. Aucun
 * `fetch`/`axios`/`HttpClient` direct ici — uniquement `AuthApiService`.
 *
 * Stockage (imposé, voir brief FE3) :
 * - `accessToken` : UNIQUEMENT en mémoire (signal), jamais persisté (risque XSS résiduel
 *   assumé — le contrat `studentapi` renvoie les tokens en body, pas de cookie httpOnly).
 * - `refreshToken` : persisté en `localStorage` (`REFRESH_TOKEN_STORAGE_KEY`) pour
 *   survivre au reload/à la fermeture de l'onglet ; consommé par `restoreSession()` au
 *   démarrage de l'app et par `auth.interceptor.ts` pour le refresh automatique sur 401.
 *
 * `currentRole` reste un signal public en lecture seule avec la même API que le STUB
 * Épic 0 (`Signal<Role | null>`) : `roleGuard`/`role.guard.spec.ts` en dépendent
 * directement et ne doivent PAS être modifiés — voir `setRole()` ci-dessous, conservée
 * pour cette seule compatibilité.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly authApi = inject(AuthApiService);

  private readonly user = signal<User | null>(null);
  private readonly role = signal<Role | null>(null);
  private readonly token = signal<string | null>(null);

  /** Utilisateur courant (`GET /auth/me` ou champ `user` d'un `AuthResponse`), `null` si non authentifié. */
  readonly currentUser = this.user.asReadonly();

  /**
   * Rôle de l'utilisateur courant, `null` si non authentifié (visiteur). API inchangée
   * depuis le STUB Épic 0 — `roleGuard` en dépend directement, ne pas renommer/retyper.
   */
  readonly currentRole = this.role.asReadonly();

  /** Access token courant, gardé UNIQUEMENT en mémoire (jamais persisté), `null` si non authentifié. */
  readonly accessToken = this.token.asReadonly();

  /** `true` si un access token est présent en mémoire. */
  readonly isAuthenticated = computed(() => this.token() !== null);

  /**
   * Positionne `currentRole` directement, sans session complète (pas de `currentUser`,
   * pas de tokens). Conservée UNIQUEMENT pour la compatibilité avec `role.guard.spec.ts`
   * (hors périmètre FE3, ne doit pas être modifié) qui pilote le guard par rôle sans
   * passer par une authentification réelle. Ne pas utiliser dans le flux d'authentification
   * réel — préférer `setSession()`.
   */
  setRole(role: Role | null): void {
    this.role.set(role);
  }

  /**
   * Pose une session complète après `POST /auth/register` ou `POST /auth/login` : user,
   * rôle, access token (mémoire) et persistance du refresh token.
   */
  setSession(authResponse: AuthResponse): void {
    this.applyUser(authResponse.user);
    this.applyTokens(authResponse.tokens);
  }

  /**
   * Met à jour les tokens après un renouvellement (`POST /auth/refresh`), sans toucher à
   * `currentUser`/`currentRole`.
   */
  updateTokens(tokens: AuthTokens): void {
    this.applyTokens(tokens);
  }

  /** Vide la session : user, rôle, access token (mémoire) et refresh token persisté. */
  clear(): void {
    this.user.set(null);
    this.role.set(null);
    this.token.set(null);
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  }

  /**
   * Tente de renouveler l'access token à partir du refresh token persisté. Utilisée par
   * `auth.interceptor.ts` sur une réponse `401` (une seule tentative, pas de boucle — voir
   * l'intercepteur). Retourne `false` sans lever d'erreur ni vider la session si aucun
   * refresh token n'est disponible ou si le renouvellement échoue : c'est à l'appelant de
   * décider d'un `clear()`.
   */
  refreshAccessToken(): Observable<boolean> {
    const refreshToken = this.getStoredRefreshToken();
    if (refreshToken === null) {
      return of(false);
    }

    return this.authApi.refresh(refreshToken).pipe(
      map((tokens) => {
        this.applyTokens(tokens);
        return true;
      }),
      catchError(() => of(false)),
    );
  }

  /**
   * Restaure la session au démarrage de l'app : si un refresh token est persisté,
   * renouvelle l'access token puis recharge l'utilisateur courant (`GET /auth/me`). En cas
   * d'échec à n'importe quelle étape (refresh token absent, invalide/expiré, ou `/auth/me`
   * en échec), la session est vidée (`clear()`) et l'observable résout `false`.
   */
  restoreSession(): Observable<boolean> {
    const refreshToken = this.getStoredRefreshToken();
    if (refreshToken === null) {
      return of(false);
    }

    return this.authApi.refresh(refreshToken).pipe(
      switchMap((tokens) => {
        this.applyTokens(tokens);

        return this.authApi.me(tokens.accessToken).pipe(
          tap((user) => this.applyUser(user)),
          map(() => true),
        );
      }),
      catchError(() => {
        this.clear();
        return of(false);
      }),
    );
  }

  private applyUser(user: User): void {
    this.user.set(user);
    this.role.set(user.role);
  }

  private applyTokens(tokens: AuthTokens): void {
    this.token.set(tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, tokens.refreshToken);
  }

  private getStoredRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  }
}
