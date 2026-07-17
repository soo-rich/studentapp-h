import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthResponse, AuthTokens, LoginRequest, RegisterRequest, User } from './auth.types';

/**
 * Couche d'accès HTTP brute au domaine `/auth/*` du contrat `studentapi`
 * (`docs/openapi.yaml`, v0.2.0). Une méthode = un endpoint, sans logique de state
 * d'authentification (pas de stockage de tokens, pas de refresh automatique, pas
 * d'intercepteur Bearer) : ce service est CONSOMMÉ par `auth.queries.ts` (options
 * TanStack Query) et sera branché au state d'auth réel par `SessionService` (FE3), qui lui
 * fournira/persistera les tokens.
 *
 * Les endpoints protégés (`logout`, `me`) reçoivent l'access token en paramètre plutôt que
 * via un header ajouté automatiquement.
 */
@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/auth`;

  /** `POST /auth/register` → 201 `AuthResponse`. */
  register(payload: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/register`, payload);
  }

  /** `POST /auth/login` → 200 `AuthResponse`. */
  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/login`, payload);
  }

  /** `POST /auth/refresh` (corps `{ refreshToken }`) → 200 `AuthTokens`. */
  refresh(refreshToken: string): Observable<AuthTokens> {
    return this.http.post<AuthTokens>(`${this.baseUrl}/refresh`, { refreshToken });
  }

  /** `POST /auth/logout` (Bearer) → 204, pas de corps de réponse. */
  logout(accessToken: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/logout`, null, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  /** `GET /auth/me` (Bearer) → 200 `User`. */
  me(accessToken: string): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }
}
