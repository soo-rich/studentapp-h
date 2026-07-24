import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { ModerationApplicationsApiService } from './moderation-applications-api.service';
import {
  ModerationApplication,
  ModerationApplicationPage,
  OfferSummary,
  StudentProfile,
} from './moderation-applications.types';

describe('ModerationApplicationsApiService', () => {
  let service: ModerationApplicationsApiService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiBaseUrl}/moderation/applications`;

  const offer: OfferSummary = {
    id: 'offer-1',
    title: 'Vendeur week-end',
    opportunityType: 'temps_partiel',
    structureName: 'Boutique ABC',
  };

  const student: StudentProfile = {
    userId: 'user-1',
    firstName: 'Awa',
    lastName: 'Koffi',
    university: 'Université de Lomé',
    studentCardNumber: 'UL-2026-001',
    fieldOfStudy: 'Informatique',
    studyLevel: 'Licence 3',
    skills: ['JavaScript'],
    languages: ['Français'],
    residenceLocation: 'Lomé',
    opportunityTypes: ['temps_partiel'],
    availabilitySlots: [],
    sensitiveDataConsent: true,
    housingSituation: 'seul',
    hasDisability: false,
    disabilityDescription: null,
    allergies: null,
    sensitiveDataConsentAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
  };

  const application: ModerationApplication = {
    id: 'application-1',
    offer,
    student,
    status: 'pending_moderation',
    message: 'Je suis très motivée.',
    rejectionReason: null,
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
  };

  const applicationPage: ModerationApplicationPage = {
    items: [application],
    page: 1,
    pageSize: 20,
    total: 1,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ModerationApplicationsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list() GETs /moderation/applications with no query params when none are provided', () => {
    let result: ModerationApplicationPage | undefined;

    service.list({}).subscribe((response) => (result = response));

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().length).toBe(0);
    req.flush(applicationPage);

    expect(result).toEqual(applicationPage);
  });

  it('list() GETs /moderation/applications with status, page and pageSize query params when provided', () => {
    let result: ModerationApplicationPage | undefined;

    service
      .list({ status: 'forwarded', page: 2, pageSize: 50 })
      .subscribe((response) => (result = response));

    const req = httpMock.expectOne(
      (r) =>
        r.url === baseUrl &&
        r.params.get('status') === 'forwarded' &&
        r.params.get('page') === '2' &&
        r.params.get('pageSize') === '50',
    );
    expect(req.request.method).toBe('GET');
    req.flush(applicationPage);

    expect(result).toEqual(applicationPage);
  });

  it('get() GETs /moderation/applications/{applicationId} and returns ModerationApplication', () => {
    let result: ModerationApplication | undefined;

    service.get('application-1').subscribe((response) => (result = response));

    const req = httpMock.expectOne(`${baseUrl}/application-1`);
    expect(req.request.method).toBe('GET');
    req.flush(application);

    expect(result).toEqual(application);
  });

  it('approve() POSTs an empty body to /moderation/applications/{applicationId}/approve and returns ModerationApplication', () => {
    let result: ModerationApplication | undefined;
    const forwardedApplication: ModerationApplication = { ...application, status: 'forwarded' };

    service.approve('application-1').subscribe((response) => (result = response));

    const req = httpMock.expectOne(`${baseUrl}/application-1/approve`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(forwardedApplication);

    expect(result).toEqual(forwardedApplication);
  });

  it('reject() POSTs { reason } to /moderation/applications/{applicationId}/reject and returns ModerationApplication', () => {
    let result: ModerationApplication | undefined;
    const rejectedApplication: ModerationApplication = {
      ...application,
      status: 'rejected_moderation',
      rejectionReason: 'Profil ne correspond pas',
    };

    service
      .reject('application-1', 'Profil ne correspond pas')
      .subscribe((response) => (result = response));

    const req = httpMock.expectOne(`${baseUrl}/application-1/reject`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reason: 'Profil ne correspond pas' });
    req.flush(rejectedApplication);

    expect(result).toEqual(rejectedApplication);
  });
});
