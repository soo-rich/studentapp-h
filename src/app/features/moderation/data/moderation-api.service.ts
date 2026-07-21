import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { User } from '../../../core/auth/auth.types';
import { environment } from '../../../../environments/environment';
import {
  ModerationQueueParams,
  VerificationRequest,
  VerificationRequestPage,
} from './moderation.types';

/**
 * Couche d'accès HTTP brute au domaine `/moderation/*` du contrat `studentapi`
 * (`docs/openapi.yaml`, v0.2.0) — file de vérification réservée au rôle `moderateur` (+
 * délégués/responsables universitaires associés). Une méthode = un endpoint, sans logique de
 * state : ce service est CONSOMMÉ par `moderation.queries.ts` (options TanStack Query, voir
 * CLAUDE.md — "tout appel API passe par TanStack Query").
 *
 * Aucun header `Authorization` géré ici : `authInterceptor` (FE3) ajoute automatiquement le
 * Bearer à toute requête ciblant `environment.apiBaseUrl` (ce service n'est pas dans la liste
 * des endpoints publics exclus).
 */
@Injectable({ providedIn: 'root' })
export class ModerationApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/moderation`;

  /**
   * `GET /moderation/verifications` → 200 `VerificationRequestPage`. Les query params
   * (`status`, `page`, `pageSize`) ne sont ajoutés que s'ils sont définis : le backend
   * applique ses propres défauts (`status = 'pending'`, `page = 1`, `pageSize = 20`) sinon.
   */
  listVerifications(params: ModerationQueueParams): Observable<VerificationRequestPage> {
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

    return this.http.get<VerificationRequestPage>(`${this.baseUrl}/verifications`, {
      params: httpParams,
    });
  }

  /** `GET /moderation/verifications/{userId}` → 200 `VerificationRequest`. */
  getVerification(userId: string): Observable<VerificationRequest> {
    return this.http.get<VerificationRequest>(`${this.baseUrl}/verifications/${userId}`);
  }

  /**
   * `GET /moderation/documents/{documentId}/content` → 200 flux binaire du document
   * (téléchargement proxifié par le backend depuis l'object storage privé, aucun accès direct
   * au bucket n'est exposé).
   */
  downloadDocument(documentId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/documents/${documentId}/content`, {
      responseType: 'blob',
    });
  }

  /** `POST /moderation/verifications/{userId}/approve` (corps vide) → 200 `User` mis à jour. */
  approve(userId: string): Observable<User> {
    return this.http.post<User>(`${this.baseUrl}/verifications/${userId}/approve`, {});
  }

  /** `POST /moderation/verifications/{userId}/reject` (corps `{ reason }`) → 200 `User` mis à jour. */
  reject(userId: string, reason: string): Observable<User> {
    return this.http.post<User>(`${this.baseUrl}/verifications/${userId}/reject`, { reason });
  }
}
