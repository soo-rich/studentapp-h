import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { UrgentRequestApiService } from './urgent-request-api.service';
import { UrgentRequest, UrgentRequestErrorResponse } from './urgent-request.types';

describe('UrgentRequestApiService', () => {
  let service: UrgentRequestApiService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiBaseUrl}/students/me/urgent-request`;

  const urgentRequest: UrgentRequest = {
    id: 'urgent-1',
    status: 'pending',
    message: "J'ai besoin d'aide en urgence pour un logement.",
    moderatorNote: null,
    createdAt: '2026-07-16T00:00:00.000Z',
    reviewedAt: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(UrgentRequestApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getUrgentRequest() GETs /students/me/urgent-request and returns UrgentRequest', () => {
    let result: UrgentRequest | undefined;

    service.getUrgentRequest().subscribe((response) => (result = response));

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    expect(req.request.body).toBeNull();
    req.flush(urgentRequest);

    expect(result).toEqual(urgentRequest);
  });

  it('getUrgentRequest() surfaces a 404 URGENT_REQUEST_NOT_FOUND as an HttpErrorResponse, not a silent success', () => {
    let result: UrgentRequest | undefined;
    let error: HttpErrorResponse | undefined;
    const notFoundBody: UrgentRequestErrorResponse = {
      statusCode: 404,
      error: 'URGENT_REQUEST_NOT_FOUND',
      message: "Aucune demande d'urgence",
      timestamp: '2026-07-16T00:00:00.000Z',
      path: '/students/me/urgent-request',
    };

    service.getUrgentRequest().subscribe({
      next: (response) => (result = response),
      error: (err: HttpErrorResponse) => (error = err),
    });

    const req = httpMock.expectOne(baseUrl);
    req.flush(notFoundBody, { status: 404, statusText: 'Not Found' });

    expect(result).toBeUndefined();
    expect(error?.status).toBe(404);
    expect((error?.error as UrgentRequestErrorResponse).error).toBe('URGENT_REQUEST_NOT_FOUND');
  });

  it('createUrgentRequest() POSTs { message } to /students/me/urgent-request and returns UrgentRequest', () => {
    let result: UrgentRequest | undefined;

    service
      .createUrgentRequest({ message: urgentRequest.message })
      .subscribe((response) => (result = response));

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ message: urgentRequest.message });
    req.flush(urgentRequest, { status: 201, statusText: 'Created' });

    expect(result).toEqual(urgentRequest);
  });

  it('createUrgentRequest() surfaces a 409 URGENT_REQUEST_ALREADY_PENDING as an HttpErrorResponse', () => {
    let result: UrgentRequest | undefined;
    let error: HttpErrorResponse | undefined;
    const conflictBody: UrgentRequestErrorResponse = {
      statusCode: 409,
      error: 'URGENT_REQUEST_ALREADY_PENDING',
      message: "Une demande d'urgence est déjà en attente",
      timestamp: '2026-07-16T00:00:00.000Z',
      path: '/students/me/urgent-request',
    };

    service.createUrgentRequest({ message: urgentRequest.message }).subscribe({
      next: (response) => (result = response),
      error: (err: HttpErrorResponse) => (error = err),
    });

    const req = httpMock.expectOne(baseUrl);
    req.flush(conflictBody, { status: 409, statusText: 'Conflict' });

    expect(result).toBeUndefined();
    expect(error?.status).toBe(409);
    expect((error?.error as UrgentRequestErrorResponse).error).toBe(
      'URGENT_REQUEST_ALREADY_PENDING',
    );
  });
});
