import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { PublicOffersApiService } from './public-offers-api.service';
import {
  PublicOffer,
  PublicOfferErrorResponse,
  PublicOfferListParams,
  PublicOfferPage,
} from './public-offers.types';

describe('PublicOffersApiService', () => {
  let service: PublicOffersApiService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiBaseUrl}/offers`;

  const offer: PublicOffer = {
    id: 'offer-1',
    title: 'Serveur en salle',
    description: 'Service en salle le week-end.',
    opportunityType: 'job_vacances',
    requiredSkills: ['Service client'],
    location: 'Lomé, Agoè',
    durationLabel: '3 mois',
    compensationLabel: '50 000 FCFA / mois',
    availabilitySlots: [{ dayOfWeek: 'samedi', startTime: '08:00', endTime: '18:00' }],
    recruiter: {
      structureName: 'Le Bon Coin Resto',
      structureType: 'restaurant',
      location: 'Lomé, Agoè',
      description: null,
    },
    publishedAt: '2026-07-01T00:00:00.000Z',
  };

  const offerPage: PublicOfferPage = {
    items: [offer],
    page: 1,
    pageSize: 20,
    total: 1,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PublicOffersApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('listOffers() GETs /offers without query params when none are provided', () => {
    let result: PublicOfferPage | undefined;

    service.listOffers({}).subscribe((response) => (result = response));

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().length).toBe(0);
    req.flush(offerPage);

    expect(result).toEqual(offerPage);
  });

  it('listOffers() only sends the query params that are actually defined', () => {
    const params: PublicOfferListParams = {
      opportunityType: 'job_vacances',
      skill: 'Service client',
      location: 'Lomé',
      page: 2,
      pageSize: 10,
    };

    service.listOffers(params).subscribe();

    const req = httpMock.expectOne(
      (request) =>
        request.method === 'GET' &&
        request.url === baseUrl &&
        request.params.get('opportunityType') === 'job_vacances' &&
        request.params.get('skill') === 'Service client' &&
        request.params.get('location') === 'Lomé' &&
        request.params.get('page') === '2' &&
        request.params.get('pageSize') === '10',
    );
    req.flush(offerPage);
  });

  it('getOffer() GETs /offers/{offerId} and returns PublicOffer', () => {
    let result: PublicOffer | undefined;

    service.getOffer('offer-1').subscribe((response) => (result = response));

    const req = httpMock.expectOne(`${baseUrl}/offer-1`);
    expect(req.request.method).toBe('GET');
    req.flush(offer);

    expect(result).toEqual(offer);
  });

  it('getOffer() surfaces a 404 OFFER_NOT_FOUND as an HttpErrorResponse, not a silent success', () => {
    let result: PublicOffer | undefined;
    let error: HttpErrorResponse | undefined;
    const notFoundBody: PublicOfferErrorResponse = {
      statusCode: 404,
      error: 'OFFER_NOT_FOUND',
      message: 'Cette offre est introuvable.',
      timestamp: '2026-07-16T00:00:00.000Z',
      path: '/offers/offer-404',
    };

    service.getOffer('offer-404').subscribe({
      next: (response) => (result = response),
      error: (err: HttpErrorResponse) => (error = err),
    });

    const req = httpMock.expectOne(`${baseUrl}/offer-404`);
    req.flush(notFoundBody, { status: 404, statusText: 'Not Found' });

    expect(result).toBeUndefined();
    expect(error?.status).toBe(404);
    expect((error?.error as PublicOfferErrorResponse).error).toBe('OFFER_NOT_FOUND');
  });
});
