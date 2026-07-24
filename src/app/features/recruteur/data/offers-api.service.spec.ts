import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { OffersApiService } from './offers-api.service';
import { Offer, OfferCreateRequest, OfferPage, OfferUpdateRequest } from './offers.types';

describe('OffersApiService', () => {
  let service: OffersApiService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiBaseUrl}/recruiters/me/offers`;

  const offer: Offer = {
    id: 'offer-1',
    title: 'Serveur pour événement',
    description: 'Service en salle pour un événement de deux jours.',
    opportunityType: 'job_vacances',
    requiredSkills: ['Sens du service'],
    location: 'Lomé, Agoè',
    durationLabel: '2 jours',
    compensationLabel: '5000 FCFA/jour',
    availabilitySlots: [{ dayOfWeek: 'samedi', startTime: '08:00', endTime: '18:00' }],
    status: 'draft',
    forwardedCandidatesCount: 0,
    publishedAt: null,
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
  };

  const createRequest: OfferCreateRequest = {
    title: 'Serveur pour événement',
    description: 'Service en salle pour un événement de deux jours.',
    opportunityType: 'job_vacances',
    requiredSkills: ['Sens du service'],
    location: 'Lomé, Agoè',
    durationLabel: '2 jours',
    compensationLabel: '5000 FCFA/jour',
    availabilitySlots: [{ dayOfWeek: 'samedi', startTime: '08:00', endTime: '18:00' }],
  };

  const updateRequest: OfferUpdateRequest = createRequest;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OffersApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('listOffers() GETs /recruiters/me/offers with only defined query params and returns OfferPage', () => {
    let result: OfferPage | undefined;
    const page: OfferPage = { items: [offer], page: 1, pageSize: 20, total: 1 };

    service.listOffers({ status: 'draft', page: 1, pageSize: 20 }).subscribe((response) => (result = response));

    const req = httpMock.expectOne(
      (r) => r.method === 'GET' && r.url === baseUrl && r.params.get('status') === 'draft',
    );
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('20');
    req.flush(page);

    expect(result).toEqual(page);
  });

  it('listOffers() omits undefined query params', () => {
    service.listOffers({}).subscribe();

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.params.keys().length).toBe(0);
    req.flush({ items: [], page: 1, pageSize: 20, total: 0 });
  });

  it('getOffer() GETs /recruiters/me/offers/{offerId} and returns Offer', () => {
    let result: Offer | undefined;

    service.getOffer('offer-1').subscribe((response) => (result = response));

    const req = httpMock.expectOne(`${baseUrl}/offer-1`);
    expect(req.request.method).toBe('GET');
    req.flush(offer);

    expect(result).toEqual(offer);
  });

  it('createOffer() POSTs the OfferCreateRequest body to /recruiters/me/offers and returns Offer', () => {
    let result: Offer | undefined;

    service.createOffer(createRequest).subscribe((response) => (result = response));

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(createRequest);
    req.flush(offer);

    expect(result).toEqual(offer);
  });

  it('updateOffer() PATCHes the OfferUpdateRequest body to /recruiters/me/offers/{offerId} and returns Offer', () => {
    let result: Offer | undefined;

    service.updateOffer('offer-1', updateRequest).subscribe((response) => (result = response));

    const req = httpMock.expectOne(`${baseUrl}/offer-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(updateRequest);
    req.flush(offer);

    expect(result).toEqual(offer);
  });

  it('publishOffer() POSTs an empty body to /recruiters/me/offers/{offerId}/publish and returns Offer', () => {
    let result: Offer | undefined;
    const published = { ...offer, status: 'published' as const };

    service.publishOffer('offer-1').subscribe((response) => (result = response));

    const req = httpMock.expectOne(`${baseUrl}/offer-1/publish`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(published);

    expect(result).toEqual(published);
  });

  it('closeOffer() POSTs an empty body to /recruiters/me/offers/{offerId}/close and returns Offer', () => {
    let result: Offer | undefined;
    const closed = { ...offer, status: 'closed' as const };

    service.closeOffer('offer-1').subscribe((response) => (result = response));

    const req = httpMock.expectOne(`${baseUrl}/offer-1/close`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(closed);

    expect(result).toEqual(closed);
  });
});
