import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { PublicOffer, PublicOfferListParams, PublicOfferPage } from './public-offers.types';

/**
 * Couche d'accès HTTP brute au domaine `/offers*` du contrat `studentapi`
 * (`docs/openapi.yaml`, v0.4.0) — offres PUBLIÉES telles que vues par l'étudiant. Une méthode =
 * un endpoint, sans logique de state : ce service est CONSOMMÉ par `public-offers.queries.ts`
 * (options TanStack Query, voir CLAUDE.md — "tout appel API passe par TanStack Query").
 *
 * Aucun header `Authorization` géré ici : `authInterceptor` (FE3) ajoute automatiquement le
 * Bearer à toute requête ciblant `environment.apiBaseUrl` (ce service n'est pas dans la liste
 * des endpoints publics exclus).
 */
@Injectable({ providedIn: 'root' })
export class PublicOffersApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/offers`;

  /**
   * `GET /offers` → 200 `PublicOfferPage`. Les query params (`opportunityType`, `skill`,
   * `location`, `page`, `pageSize`) ne sont ajoutés que s'ils sont définis : le backend
   * applique ses propres défauts (`page = 1`, `pageSize = 20`) sinon.
   */
  listOffers(params: PublicOfferListParams): Observable<PublicOfferPage> {
    let httpParams = new HttpParams();

    if (params.opportunityType !== undefined) {
      httpParams = httpParams.set('opportunityType', params.opportunityType);
    }
    if (params.skill !== undefined) {
      httpParams = httpParams.set('skill', params.skill);
    }
    if (params.location !== undefined) {
      httpParams = httpParams.set('location', params.location);
    }
    if (params.page !== undefined) {
      httpParams = httpParams.set('page', params.page);
    }
    if (params.pageSize !== undefined) {
      httpParams = httpParams.set('pageSize', params.pageSize);
    }

    return this.http.get<PublicOfferPage>(this.baseUrl, { params: httpParams });
  }

  /** `GET /offers/{offerId}` → 200 `PublicOffer` | 404 `OFFER_NOT_FOUND`. */
  getOffer(offerId: string): Observable<PublicOffer> {
    return this.http.get<PublicOffer>(`${this.baseUrl}/${offerId}`);
  }
}
