import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { StudentProfile, StudentProfileUpsertRequest } from './profile.types';

/**
 * Couche d'accès HTTP brute au domaine `/students/me/profile` du contrat `studentapi`
 * (`docs/openapi.yaml`, v0.3.0) — profil détaillé de l'étudiant COURANT uniquement (PAS
 * `/students/me/urgent-request` ni `/moderation/students/{userId}/profile`, hors périmètre).
 * Une méthode = un endpoint, sans logique de state : ce service est CONSOMMÉ par
 * `profile.queries.ts` (options TanStack Query, voir CLAUDE.md — "tout appel API passe par
 * TanStack Query").
 *
 * Aucun header `Authorization` géré ici : `authInterceptor` (FE3) ajoute automatiquement le
 * Bearer à toute requête ciblant `environment.apiBaseUrl` (ce service n'est pas dans la liste
 * des endpoints publics exclus).
 */
@Injectable({ providedIn: 'root' })
export class ProfileApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/students/me`;

  /**
   * `GET /students/me/profile` → 200 `StudentProfile` | 404 `PROFILE_NOT_FOUND` (profil pas
   * encore créé).
   */
  getProfile(): Observable<StudentProfile> {
    return this.http.get<StudentProfile>(`${this.baseUrl}/profile`);
  }

  /**
   * `PUT /students/me/profile` (upsert idempotent) → 200 `StudentProfile` | 422 (validation
   * échouée, ou champs sensibles fournis sans consentement —
   * `PROFILE_SENSITIVE_CONSENT_REQUIRED`).
   */
  upsertProfile(body: StudentProfileUpsertRequest): Observable<StudentProfile> {
    return this.http.put<StudentProfile>(`${this.baseUrl}/profile`, body);
  }
}
