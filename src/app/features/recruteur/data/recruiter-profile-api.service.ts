import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { RecruiterProfile, RecruiterProfileUpsertRequest } from './recruiter-profile.types';

/**
 * Couche d'accès HTTP brute au domaine `/recruiters/me/profile` du contrat `studentapi`
 * (`docs/openapi.yaml`, v0.4.0) — profil de structure du recruteur COURANT uniquement. Une
 * méthode = un endpoint, sans logique de state : ce service est CONSOMMÉ par
 * `recruiter-profile.queries.ts` (options TanStack Query, voir CLAUDE.md — "tout appel API
 * passe par TanStack Query").
 *
 * Aucun header `Authorization` géré ici : `authInterceptor` (FE3) ajoute automatiquement le
 * Bearer à toute requête ciblant `environment.apiBaseUrl` (ce service n'est pas dans la liste
 * des endpoints publics exclus).
 */
@Injectable({ providedIn: 'root' })
export class RecruiterProfileApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/recruiters/me`;

  /**
   * `GET /recruiters/me/profile` → 200 `RecruiterProfile` | 404 `RECRUITER_PROFILE_NOT_FOUND`
   * (profil pas encore créé — cas NOMINAL, pas une erreur).
   */
  getProfile(): Observable<RecruiterProfile> {
    return this.http.get<RecruiterProfile>(`${this.baseUrl}/profile`);
  }

  /**
   * `PUT /recruiters/me/profile` (upsert idempotent) → 200 `RecruiterProfile` | 422
   * (validation échouée).
   */
  upsertProfile(body: RecruiterProfileUpsertRequest): Observable<RecruiterProfile> {
    return this.http.put<RecruiterProfile>(`${this.baseUrl}/profile`, body);
  }
}
