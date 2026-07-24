import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { CandidatesApiService } from './candidates-api.service';
import { CandidateCard, CandidateCardPage, CandidateContact } from './candidates.types';

describe('CandidatesApiService', () => {
  let service: CandidatesApiService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiBaseUrl}/recruiters/me/offers`;

  const candidate: CandidateCard = {
    applicationId: 'application-1',
    status: 'forwarded',
    university: 'Université de Lomé',
    fieldOfStudy: 'Informatique',
    studyLevel: 'Licence 3',
    skills: ['JavaScript'],
    languages: ['Français'],
    experiences: null,
    opportunityTypes: ['job_vacances'],
    availabilitySlots: [{ dayOfWeek: 'samedi', startTime: '08:00', endTime: '18:00' }],
    residenceArea: 'Lomé, Agoè',
  };

  const contact: CandidateContact = {
    firstName: 'Ama',
    lastName: 'Koffi',
    phoneNumber: '+228 90 00 00 00',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CandidatesApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('listCandidates() GETs /recruiters/me/offers/{offerId}/candidates with only defined query params and returns CandidateCardPage', () => {
    let result: CandidateCardPage | undefined;
    const page: CandidateCardPage = { items: [candidate], page: 1, pageSize: 20, total: 1 };

    service
      .listCandidates('offer-1', { status: 'forwarded', page: 1, pageSize: 20 })
      .subscribe((response) => (result = response));

    const req = httpMock.expectOne(
      (r) =>
        r.method === 'GET' &&
        r.url === `${baseUrl}/offer-1/candidates` &&
        r.params.get('status') === 'forwarded',
    );
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('20');
    req.flush(page);

    expect(result).toEqual(page);
  });

  it('listCandidates() omits undefined query params', () => {
    service.listCandidates('offer-1', {}).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/offer-1/candidates`);
    expect(req.request.params.keys().length).toBe(0);
    req.flush({ items: [], page: 1, pageSize: 20, total: 0 });
  });

  it('selectCandidate() POSTs an empty body to the select endpoint and returns the updated CandidateCard', () => {
    let result: CandidateCard | undefined;
    const selected = { ...candidate, status: 'selected' as const };

    service.selectCandidate('offer-1', 'application-1').subscribe((response) => (result = response));

    const req = httpMock.expectOne(`${baseUrl}/offer-1/candidates/application-1/select`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(selected);

    expect(result).toEqual(selected);
  });

  it('getCandidateContact() GETs the contact endpoint and returns CandidateContact', () => {
    let result: CandidateContact | undefined;

    service
      .getCandidateContact('offer-1', 'application-1')
      .subscribe((response) => (result = response));

    const req = httpMock.expectOne(`${baseUrl}/offer-1/candidates/application-1/contact`);
    expect(req.request.method).toBe('GET');
    req.flush(contact);

    expect(result).toEqual(contact);
  });
});
