import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  ApplicationCreateRequest,
  StudentApplication,
  StudentApplicationListParams,
  StudentApplicationPage,
} from './applications.types';

/**
 * Couche d'accès HTTP brute au domaine `applications` du contrat `studentapi`
 * (`docs/openapi.yaml`, v0.4.0) — candidatures de l'étudiant COURANT uniquement (PAS
 * `/moderation/applications*`, réservé au rôle `moderateur`, hors périmètre). Une méthode = un
 * endpoint, sans logique de state : ce service est CONSOMMÉ par `applications.queries.ts`
 * (options TanStack Query, voir CLAUDE.md — "tout appel API passe par TanStack Query").
 *
 * Aucun header `Authorization` géré ici : `authInterceptor` (FE3) ajoute automatiquement le
 * Bearer à toute requête ciblant `environment.apiBaseUrl` (ce service n'est pas dans la liste
 * des endpoints publics exclus).
 */
@Injectable({ providedIn: 'root' })
export class ApplicationsApiService {
  private readonly http = inject(HttpClient);
  private readonly offersUrl = `${environment.apiBaseUrl}/offers`;
  private readonly baseUrl = `${environment.apiBaseUrl}/students/me/applications`;

  /**
   * `POST /offers/{offerId}/applications` → 201 `StudentApplication` (statut initial
   * `pending_moderation`) | 404 `OFFER_NOT_FOUND` | 409 `APPLICATION_ALREADY_EXISTS` | 422
   * `OFFER_NOT_OPEN` / `PROFILE_REQUIRED`.
   */
  apply(offerId: string, body: ApplicationCreateRequest): Observable<StudentApplication> {
    return this.http.post<StudentApplication>(`${this.offersUrl}/${offerId}/applications`, body);
  }

  /**
   * `GET /students/me/applications` → 200 `StudentApplicationPage`. Les query params
   * (`status`, `page`, `pageSize`) ne sont ajoutés que s'ils sont définis : le backend applique
   * ses propres défauts (`page = 1`, `pageSize = 20`) sinon.
   */
  listApplications(params: StudentApplicationListParams): Observable<StudentApplicationPage> {
    let httpParams = new HttpParams();

    if (params.status !== undefined) {
      httpParams = httpParams.set('status', params.status);
    }
    if (params.page !== undefined) {
      httpParams = httpParams.set('page', params.page);
    }
    if (params.pageSize !== undefined) {
      httpParams = httpParams.set('pageSize', params.pageSize);
    }

    return this.http.get<StudentApplicationPage>(this.baseUrl, { params: httpParams });
  }

  /** `GET /students/me/applications/{applicationId}` → 200 `StudentApplication` | 404 `APPLICATION_NOT_FOUND`. */
  getApplication(applicationId: string): Observable<StudentApplication> {
    return this.http.get<StudentApplication>(`${this.baseUrl}/${applicationId}`);
  }

  /**
   * `DELETE /students/me/applications/{applicationId}` → 204, pas de corps de réponse (statut
   * final `withdrawn`) | 404 `APPLICATION_NOT_FOUND` | 409 `APPLICATION_NOT_WITHDRAWABLE`
   * (candidature déjà dans un état terminal).
   */
  withdraw(applicationId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${applicationId}`);
  }

  /**
   * `POST /students/me/applications/{applicationId}/accept` (corps vide) → 200
   * `StudentApplication` (`selected` → `accepted`) | 404 `APPLICATION_NOT_FOUND` | 409
   * `APPLICATION_INVALID_STATE`.
   */
  accept(applicationId: string): Observable<StudentApplication> {
    return this.http.post<StudentApplication>(`${this.baseUrl}/${applicationId}/accept`, {});
  }

  /**
   * `POST /students/me/applications/{applicationId}/decline` (corps vide) → 200
   * `StudentApplication` (`selected` → `declined`) | 404 `APPLICATION_NOT_FOUND` | 409
   * `APPLICATION_INVALID_STATE`.
   */
  decline(applicationId: string): Observable<StudentApplication> {
    return this.http.post<StudentApplication>(`${this.baseUrl}/${applicationId}/decline`, {});
  }
}
