import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { ApplicationsApiService } from './applications-api.service';
import {
  ApplicationErrorResponse,
  StudentApplication,
  StudentApplicationListParams,
  StudentApplicationPage,
} from './applications.types';

describe('ApplicationsApiService', () => {
  let service: ApplicationsApiService;
  let httpMock: HttpTestingController;

  const offersUrl = `${environment.apiBaseUrl}/offers`;
  const baseUrl = `${environment.apiBaseUrl}/students/me/applications`;

  const application: StudentApplication = {
    id: 'app-1',
    offer: {
      id: 'offer-1',
      title: 'Serveur en salle',
      opportunityType: 'job_vacances',
      structureName: 'Le Bon Coin Resto',
    },
    status: 'pending_moderation',
    message: 'Disponible tous les week-ends.',
    rejectionReason: null,
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
  };

  const applicationPage: StudentApplicationPage = {
    items: [application],
    page: 1,
    pageSize: 20,
    total: 1,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApplicationsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('apply() POSTs the ApplicationCreateRequest body to /offers/{offerId}/applications and returns StudentApplication', () => {
    let result: StudentApplication | undefined;

    service
      .apply('offer-1', { message: 'Disponible tous les week-ends.' })
      .subscribe((response) => (result = response));

    const req = httpMock.expectOne(`${offersUrl}/offer-1/applications`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ message: 'Disponible tous les week-ends.' });
    req.flush(application, { status: 201, statusText: 'Created' });

    expect(result).toEqual(application);
  });

  it('apply() surfaces a 409 APPLICATION_ALREADY_EXISTS as an HttpErrorResponse', () => {
    let error: HttpErrorResponse | undefined;
    const conflictBody: ApplicationErrorResponse = {
      statusCode: 409,
      error: 'APPLICATION_ALREADY_EXISTS',
      message: 'Tu as déjà candidaté à cette offre.',
      timestamp: '2026-07-16T00:00:00.000Z',
      path: '/offers/offer-1/applications',
    };

    service.apply('offer-1', { message: null }).subscribe({
      next: () => {},
      error: (err: HttpErrorResponse) => (error = err),
    });

    const req = httpMock.expectOne(`${offersUrl}/offer-1/applications`);
    req.flush(conflictBody, { status: 409, statusText: 'Conflict' });

    expect(error?.status).toBe(409);
    expect((error?.error as ApplicationErrorResponse).error).toBe('APPLICATION_ALREADY_EXISTS');
  });

  it('listApplications() only sends the query params that are actually defined', () => {
    const params: StudentApplicationListParams = {
      status: 'forwarded',
      page: 2,
      pageSize: 10,
    };

    service.listApplications(params).subscribe();

    const req = httpMock.expectOne(
      (request) =>
        request.method === 'GET' &&
        request.url === baseUrl &&
        request.params.get('status') === 'forwarded' &&
        request.params.get('page') === '2' &&
        request.params.get('pageSize') === '10',
    );
    req.flush(applicationPage);
  });

  it('listApplications() GETs /students/me/applications without query params when none are provided', () => {
    let result: StudentApplicationPage | undefined;

    service.listApplications({}).subscribe((response) => (result = response));

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().length).toBe(0);
    req.flush(applicationPage);

    expect(result).toEqual(applicationPage);
  });

  it('getApplication() GETs /students/me/applications/{applicationId} and returns StudentApplication', () => {
    let result: StudentApplication | undefined;

    service.getApplication('app-1').subscribe((response) => (result = response));

    const req = httpMock.expectOne(`${baseUrl}/app-1`);
    expect(req.request.method).toBe('GET');
    req.flush(application);

    expect(result).toEqual(application);
  });

  it('withdraw() DELETEs /students/me/applications/{applicationId} with no response body', () => {
    let completed = false;

    service.withdraw('app-1').subscribe({ complete: () => (completed = true) });

    const req = httpMock.expectOne(`${baseUrl}/app-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  it('withdraw() surfaces a 409 APPLICATION_NOT_WITHDRAWABLE as an HttpErrorResponse', () => {
    let error: HttpErrorResponse | undefined;
    const conflictBody: ApplicationErrorResponse = {
      statusCode: 409,
      error: 'APPLICATION_NOT_WITHDRAWABLE',
      message: 'Cette candidature ne peut plus être retirée.',
      timestamp: '2026-07-16T00:00:00.000Z',
      path: '/students/me/applications/app-1',
    };

    service.withdraw('app-1').subscribe({
      next: () => {},
      error: (err: HttpErrorResponse) => (error = err),
    });

    const req = httpMock.expectOne(`${baseUrl}/app-1`);
    req.flush(conflictBody, { status: 409, statusText: 'Conflict' });

    expect(error?.status).toBe(409);
    expect((error?.error as ApplicationErrorResponse).error).toBe(
      'APPLICATION_NOT_WITHDRAWABLE',
    );
  });

  it('accept() POSTs an empty body to /students/me/applications/{applicationId}/accept and returns StudentApplication', () => {
    let result: StudentApplication | undefined;
    const acceptedApplication: StudentApplication = { ...application, status: 'accepted' };

    service.accept('app-1').subscribe((response) => (result = response));

    const req = httpMock.expectOne(`${baseUrl}/app-1/accept`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(acceptedApplication);

    expect(result).toEqual(acceptedApplication);
  });

  it('decline() POSTs an empty body to /students/me/applications/{applicationId}/decline and returns StudentApplication', () => {
    let result: StudentApplication | undefined;
    const declinedApplication: StudentApplication = { ...application, status: 'declined' };

    service.decline('app-1').subscribe((response) => (result = response));

    const req = httpMock.expectOne(`${baseUrl}/app-1/decline`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(declinedApplication);

    expect(result).toEqual(declinedApplication);
  });

  it('accept()/decline() surface a 409 APPLICATION_INVALID_STATE as an HttpErrorResponse', () => {
    let error: HttpErrorResponse | undefined;
    const conflictBody: ApplicationErrorResponse = {
      statusCode: 409,
      error: 'APPLICATION_INVALID_STATE',
      message: 'Cette candidature ne peut plus être traitée.',
      timestamp: '2026-07-16T00:00:00.000Z',
      path: '/students/me/applications/app-1/accept',
    };

    service.accept('app-1').subscribe({
      next: () => {},
      error: (err: HttpErrorResponse) => (error = err),
    });

    const req = httpMock.expectOne(`${baseUrl}/app-1/accept`);
    req.flush(conflictBody, { status: 409, statusText: 'Conflict' });

    expect(error?.status).toBe(409);
    expect((error?.error as ApplicationErrorResponse).error).toBe('APPLICATION_INVALID_STATE');
  });
});
