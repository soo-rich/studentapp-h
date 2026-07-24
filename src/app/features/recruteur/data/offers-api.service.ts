import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  Offer,
  OfferCreateRequest,
  OfferPage,
  OfferQueueParams,
  OfferUpdateRequest,
} from './offers.types';

/**
 * Couche d'accès HTTP brute au domaine `/recruiters/me/offers*` du contrat `studentapi`
 * (`docs/openapi.yaml`, v0.4.0) — offres du recruteur COURANT uniquement. Une méthode = un
 * endpoint, sans logique de state : ce service est CONSOMMÉ par `offers.queries.ts` (options
 * TanStack Query, voir CLAUDE.md — "tout appel API passe par TanStack Query").
 *
 * Aucun header `Authorization` géré ici : `authInterceptor` (FE3) ajoute automatiquement le
 * Bearer à toute requête ciblant `environment.apiBaseUrl` (ce service n'est pas dans la liste
 * des endpoints publics exclus).
 */
@Injectable({ providedIn: 'root' })
export class OffersApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/recruiters/me/offers`;

  /**
   * `GET /recruiters/me/offers` → 200 `OfferPage`. Les query params (`status`, `page`,
   * `pageSize`) ne sont ajoutés que s'ils sont définis : le backend applique ses propres
   * défauts (`page = 1`, `pageSize = 20`) sinon.
   */
  listOffers(params: OfferQueueParams): Observable<OfferPage> {
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

    return this.http.get<OfferPage>(this.baseUrl, { params: httpParams });
  }

  /** `GET /recruiters/me/offers/{offerId}` → 200 `Offer` | 404 `OFFER_NOT_FOUND`. */
  getOffer(offerId: string): Observable<Offer> {
    return this.http.get<Offer>(`${this.baseUrl}/${offerId}`);
  }

  /**
   * `POST /recruiters/me/offers` → 201 `Offer` (créée au statut `draft`) | 422
   * `RECRUITER_PROFILE_REQUIRED` (aucun profil recruteur).
   */
  createOffer(body: OfferCreateRequest): Observable<Offer> {
    return this.http.post<Offer>(this.baseUrl, body);
  }

  /**
   * `PATCH /recruiters/me/offers/{offerId}` → 200 `Offer` | 404 `OFFER_NOT_FOUND` | 409
   * `OFFER_NOT_EDITABLE` (offre déjà publiée ou fermée).
   */
  updateOffer(offerId: string, body: OfferUpdateRequest): Observable<Offer> {
    return this.http.patch<Offer>(`${this.baseUrl}/${offerId}`, body);
  }

  /**
   * `POST /recruiters/me/offers/{offerId}/publish` (corps vide) → 200 `Offer` | 404
   * `OFFER_NOT_FOUND` | 409 `OFFER_INVALID_STATE` (transition `draft` → `published` invalide).
   */
  publishOffer(offerId: string): Observable<Offer> {
    return this.http.post<Offer>(`${this.baseUrl}/${offerId}/publish`, {});
  }

  /**
   * `POST /recruiters/me/offers/{offerId}/close` (corps vide) → 200 `Offer` | 404
   * `OFFER_NOT_FOUND` | 409 `OFFER_INVALID_STATE` (transition `published` → `closed` invalide).
   */
  closeOffer(offerId: string): Observable<Offer> {
    return this.http.post<Offer>(`${this.baseUrl}/${offerId}/close`, {});
  }
}
