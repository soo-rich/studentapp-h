import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { ModerationApiService } from './moderation-api.service';
import { User } from '../../../core/auth/auth.types';
import { VerificationDocument } from '../../verification/data/verification.types';
import { VerificationRequest, VerificationRequestPage } from './moderation.types';

describe('ModerationApiService', () => {
  let service: ModerationApiService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiBaseUrl}/moderation`;

  const user: User = {
    id: 'user-1',
    email: 'etudiant@example.com',
    role: 'etudiant',
    verificationStatus: 'pending',
    createdAt: '2026-07-16T00:00:00.000Z',
  };

  const document: VerificationDocument = {
    id: 'doc-1',
    type: 'carte_etudiant',
    originalFilename: 'carte-etudiant.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 123456,
    uploadedAt: '2026-07-16T00:00:00.000Z',
  };

  const verificationRequest: VerificationRequest = {
    user,
    documents: [document],
    submittedAt: '2026-07-16T00:00:00.000Z',
  };

  const verificationRequestPage: VerificationRequestPage = {
    items: [verificationRequest],
    page: 1,
    pageSize: 20,
    total: 1,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ModerationApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('listVerifications() GETs /moderation/verifications with no query params when none are provided', () => {
    let result: VerificationRequestPage | undefined;

    service.listVerifications({}).subscribe((response) => (result = response));

    const req = httpMock.expectOne(`${baseUrl}/verifications`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().length).toBe(0);
    req.flush(verificationRequestPage);

    expect(result).toEqual(verificationRequestPage);
  });

  it('listVerifications() GETs /moderation/verifications with status, page and pageSize query params when provided', () => {
    let result: VerificationRequestPage | undefined;

    service
      .listVerifications({ status: 'pending', page: 2, pageSize: 50 })
      .subscribe((response) => (result = response));

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/verifications` &&
        r.params.get('status') === 'pending' &&
        r.params.get('page') === '2' &&
        r.params.get('pageSize') === '50',
    );
    expect(req.request.method).toBe('GET');
    req.flush(verificationRequestPage);

    expect(result).toEqual(verificationRequestPage);
  });

  it('getVerification() GETs /moderation/verifications/{userId} and returns VerificationRequest', () => {
    let result: VerificationRequest | undefined;

    service.getVerification('user-1').subscribe((response) => (result = response));

    const req = httpMock.expectOne(`${baseUrl}/verifications/user-1`);
    expect(req.request.method).toBe('GET');
    req.flush(verificationRequest);

    expect(result).toEqual(verificationRequest);
  });

  it('downloadDocument() GETs /moderation/documents/{documentId}/content with responseType blob', () => {
    let result: Blob | undefined;
    const blob = new Blob(['contenu'], { type: 'application/pdf' });

    service.downloadDocument('doc-1').subscribe((response) => (result = response));

    const req = httpMock.expectOne(`${baseUrl}/documents/doc-1/content`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(blob);

    expect(result).toEqual(blob);
  });

  it('approve() POSTs an empty body to /moderation/verifications/{userId}/approve and returns User', () => {
    let result: User | undefined;
    const approvedUser: User = { ...user, verificationStatus: 'verified' };

    service.approve('user-1').subscribe((response) => (result = response));

    const req = httpMock.expectOne(`${baseUrl}/verifications/user-1/approve`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(approvedUser);

    expect(result).toEqual(approvedUser);
  });

  it('reject() POSTs { reason } to /moderation/verifications/{userId}/reject and returns User', () => {
    let result: User | undefined;
    const rejectedUser: User = {
      ...user,
      verificationStatus: 'rejected',
      verificationRejectionReason: 'Document illisible',
    };

    service.reject('user-1', 'Document illisible').subscribe((response) => (result = response));

    const req = httpMock.expectOne(`${baseUrl}/verifications/user-1/reject`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reason: 'Document illisible' });
    req.flush(rejectedUser);

    expect(result).toEqual(rejectedUser);
  });
});
