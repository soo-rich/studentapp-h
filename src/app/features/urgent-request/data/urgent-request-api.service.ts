import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { UrgentRequest, UrgentRequestCreateRequest } from './urgent-request.types';

/**
 * Couche d'accès HTTP brute au domaine `/students/me/urgent-request` du contrat `studentapi`
 * (`docs/openapi.yaml`, v0.3.0) — demande d'urgence de l'utilisateur COURANT (rôle `etudiant`)
 * uniquement (PAS `/moderation/urgent-requests*`, réservé au rôle `moderateur`, hors
 * périmètre). Une méthode = un endpoint, sans logique de state : ce service est CONSOMMÉ par
 * `urgent-request.queries.ts` (options TanStack Query, voir CLAUDE.md — "tout appel API passe
 * par TanStack Query").
 *
 * Aucun header `Authorization` géré ici : `authInterceptor` (FE3) ajoute automatiquement le
 * Bearer à toute requête ciblant `environment.apiBaseUrl` (ce service n'est pas dans la liste
 * des endpoints publics exclus).
 */
@Injectable({ providedIn: 'root' })
export class UrgentRequestApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/students/me`;

  /**
   * `GET /students/me/urgent-request` → 200 `UrgentRequest`. Le backend renvoie 404
   * `URGENT_REQUEST_NOT_FOUND` quand l'étudiant n'a aucune demande : c'est un cas métier
   * NORMAL, PAS une erreur. L'Observable se met néanmoins en erreur sur ce 404 (comportement
   * standard `HttpClient` sur tout statut non-2xx) : le traitement de ce cas revient à
   * `urgent-request.queries.ts` (voir le commentaire d'`injectUrgentRequestQuery`), pas à ce
   * service, qui reste une simple projection 1 méthode = 1 endpoint.
   */
  getUrgentRequest(): Observable<UrgentRequest> {
    return this.http.get<UrgentRequest>(`${this.baseUrl}/urgent-request`);
  }

  /**
   * `POST /students/me/urgent-request` → 201 `UrgentRequest`. Rejeté en 409
   * `URGENT_REQUEST_ALREADY_PENDING` si une demande `pending` existe déjà, en 422 si `message`
   * est absent ou hors bornes (10 à 1000 caractères).
   */
  createUrgentRequest(body: UrgentRequestCreateRequest): Observable<UrgentRequest> {
    return this.http.post<UrgentRequest>(`${this.baseUrl}/urgent-request`, body);
  }
}
