import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { DocumentType, VerificationDocument } from './verification.types';

/**
 * Couche d'accès HTTP brute au domaine `/verification/documents*` du contrat `studentapi`
 * (`docs/openapi.yaml`, v0.2.0) — documents de vérification de l'utilisateur COURANT
 * uniquement (PAS `/moderation/*`, réservé au rôle `moderateur`, hors périmètre). Une méthode =
 * un endpoint, sans logique de state : ce service est CONSOMMÉ par `verification.queries.ts`
 * (options TanStack Query, voir CLAUDE.md — "tout appel API passe par TanStack Query").
 *
 * Aucun header `Authorization` géré ici : `authInterceptor` (FE3) ajoute automatiquement le
 * Bearer à toute requête ciblant `environment.apiBaseUrl` (ce service n'est pas dans la liste
 * des endpoints publics exclus).
 */
@Injectable({ providedIn: 'root' })
export class VerificationApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/verification/documents`;

  /** `GET /verification/documents` → 200 `VerificationDocument[]`. */
  list(): Observable<VerificationDocument[]> {
    return this.http.get<VerificationDocument[]>(this.baseUrl);
  }

  /**
   * `POST /verification/documents` (multipart/form-data, champs `type` + `file`) → 201
   * `VerificationDocument`. Aucun `Content-Type` n'est forcé : le navigateur pose lui-même
   * l'en-tête `multipart/form-data; boundary=...` requis pour un `FormData`.
   */
  upload(type: DocumentType, file: File): Observable<VerificationDocument> {
    const formData = new FormData();
    formData.append('type', type);
    formData.append('file', file);

    return this.http.post<VerificationDocument>(this.baseUrl, formData);
  }

  /** `DELETE /verification/documents/{documentId}` → 204, pas de corps de réponse. */
  delete(documentId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${documentId}`);
  }
}
