import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { VerificationApiService } from './verification-api.service';
import { VerificationDocument } from './verification.types';

describe('VerificationApiService', () => {
  let service: VerificationApiService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiBaseUrl}/verification/documents`;

  const document: VerificationDocument = {
    id: 'doc-1',
    type: 'carte_etudiant',
    originalFilename: 'carte-etudiant.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 123456,
    uploadedAt: '2026-07-16T00:00:00.000Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(VerificationApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list() GETs /verification/documents and returns VerificationDocument[]', () => {
    let result: VerificationDocument[] | undefined;

    service.list().subscribe((response) => (result = response));

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush([document]);

    expect(result).toEqual([document]);
  });

  it('upload() POSTs a FormData with "type" and "file" to /verification/documents and returns VerificationDocument', () => {
    const file = new File(['contenu'], 'carte-etudiant.pdf', { type: 'application/pdf' });
    let result: VerificationDocument | undefined;

    service.upload('carte_etudiant', file).subscribe((response) => (result = response));

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeInstanceOf(FormData);

    const body = req.request.body as FormData;
    expect(body.get('type')).toBe('carte_etudiant');
    expect(body.get('file')).toBe(file);

    // Aucun Content-Type forcé : le navigateur pose lui-même le boundary multipart.
    expect(req.request.headers.has('Content-Type')).toBe(false);

    req.flush(document, { status: 201, statusText: 'Created' });

    expect(result).toEqual(document);
  });

  it('delete() DELETEs /verification/documents/{documentId} with no body', () => {
    let completed = false;

    service.delete('doc-1').subscribe({
      complete: () => (completed = true),
    });

    const req = httpMock.expectOne(`${baseUrl}/doc-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });
});
