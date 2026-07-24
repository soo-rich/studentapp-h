import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  ApplicationRejectRequest,
  ModerationApplication,
  ModerationApplicationPage,
  ModerationApplicationsQueueParams,
} from './moderation-applications.types';

/**
 * Couche d'accès HTTP brute au domaine `/moderation/applications/*` du contrat `studentapi`
 * (`docs/openapi.yaml`, v0.4.0) — file de candidatures réservée au rôle `moderateur` (Épic 3).
 * Une méthode = un endpoint, sans logique de state : ce service est CONSOMMÉ par
 * `moderation-applications.queries.ts` (options TanStack Query, voir CLAUDE.md — "tout appel
 * API passe par TanStack Query").
 *
 * Aucun header `Authorization` géré ici : `authInterceptor` (FE3) ajoute automatiquement le
 * Bearer à toute requête ciblant `environment.apiBaseUrl`.
 *
 * Fichier NEUF, volontairement séparé de `moderation-api.service.ts` (Épic 1/2) — voir
 * périmètre de la tâche « candidatures ».
 */
@Injectable({ providedIn: 'root' })
export class ModerationApplicationsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/moderation/applications`;

  /**
   * `GET /moderation/applications` → 200 `ModerationApplicationPage`. Les query params
   * (`status`, `page`, `pageSize`) ne sont ajoutés que s'ils sont définis : le backend applique
   * son propre défaut (`status = 'pending_moderation'`, `page = 1`, `pageSize = 20`) sinon.
   */
  list(params: ModerationApplicationsQueueParams): Observable<ModerationApplicationPage> {
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

    return this.http.get<ModerationApplicationPage>(this.baseUrl, { params: httpParams });
  }

  /** `GET /moderation/applications/{applicationId}` → 200 `ModerationApplication`. */
  get(applicationId: string): Observable<ModerationApplication> {
    return this.http.get<ModerationApplication>(`${this.baseUrl}/${applicationId}`);
  }

  /**
   * `POST /moderation/applications/{applicationId}/approve` (corps vide) → 200
   * `ModerationApplication` (`pending_moderation` → `forwarded`).
   */
  approve(applicationId: string): Observable<ModerationApplication> {
    return this.http.post<ModerationApplication>(`${this.baseUrl}/${applicationId}/approve`, {});
  }

  /**
   * `POST /moderation/applications/{applicationId}/reject` (corps `{ reason }`) → 200
   * `ModerationApplication` (`pending_moderation` → `rejected_moderation`).
   */
  reject(applicationId: string, reason: string): Observable<ModerationApplication> {
    const body: ApplicationRejectRequest = { reason };
    return this.http.post<ModerationApplication>(`${this.baseUrl}/${applicationId}/reject`, body);
  }
}
