import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  CandidateCard,
  CandidateCardPage,
  CandidateContact,
  CandidateQueueParams,
} from './candidates.types';

/**
 * Couche d'accès HTTP brute au domaine `/recruiters/me/offers/{offerId}/candidates*` du
 * contrat `studentapi` (`docs/openapi.yaml`, v0.4.0) — fiches candidats ANONYMES d'une offre
 * du recruteur COURANT uniquement. Une méthode = un endpoint, sans logique de state : ce
 * service est CONSOMMÉ par `candidates.queries.ts` (options TanStack Query, voir CLAUDE.md —
 * "tout appel API passe par TanStack Query").
 *
 * Aucun header `Authorization` géré ici : `authInterceptor` (FE3) ajoute automatiquement le
 * Bearer à toute requête ciblant `environment.apiBaseUrl` (ce service n'est pas dans la liste
 * des endpoints publics exclus).
 */
@Injectable({ providedIn: 'root' })
export class CandidatesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/recruiters/me/offers`;

  /**
   * `GET /recruiters/me/offers/{offerId}/candidates` → 200 `CandidateCardPage`. Les query
   * params (`status`, `page`, `pageSize`) ne sont ajoutés que s'ils sont définis : le backend
   * applique ses propres défauts (`page = 1`, `pageSize = 20`) sinon.
   */
  listCandidates(offerId: string, params: CandidateQueueParams): Observable<CandidateCardPage> {
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

    return this.http.get<CandidateCardPage>(`${this.baseUrl}/${offerId}/candidates`, {
      params: httpParams,
    });
  }

  /**
   * `POST /recruiters/me/offers/{offerId}/candidates/{applicationId}/select` (corps vide) →
   * 200 `CandidateCard` mis à jour | 409 `APPLICATION_INVALID_STATE`.
   */
  selectCandidate(offerId: string, applicationId: string): Observable<CandidateCard> {
    return this.http.post<CandidateCard>(
      `${this.baseUrl}/${offerId}/candidates/${applicationId}/select`,
      {},
    );
  }

  /**
   * `GET /recruiters/me/offers/{offerId}/candidates/{applicationId}/contact` → 200
   * `CandidateContact` | 409 `CANDIDATE_CONTACT_NOT_AVAILABLE` (candidat pas encore `accepted`).
   */
  getCandidateContact(offerId: string, applicationId: string): Observable<CandidateContact> {
    return this.http.get<CandidateContact>(
      `${this.baseUrl}/${offerId}/candidates/${applicationId}/contact`,
    );
  }
}
