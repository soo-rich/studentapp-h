import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { RecruiterProfileApiService } from './recruiter-profile-api.service';
import { RecruiterProfile, RecruiterProfileUpsertRequest } from './recruiter-profile.types';

describe('RecruiterProfileApiService', () => {
  let service: RecruiterProfileApiService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiBaseUrl}/recruiters/me`;

  const profile: RecruiterProfile = {
    userId: 'user-1',
    structureName: 'Café Bon Accueil',
    structureType: 'restaurant',
    contactFirstName: 'Ama',
    contactLastName: 'Koffi',
    phoneNumber: '+228 90 00 00 00',
    location: 'Lomé, Agoè',
    description: 'Restaurant familial cherchant des étudiants pour le service.',
    updatedAt: '2026-07-16T00:00:00.000Z',
  };

  const upsertRequest: RecruiterProfileUpsertRequest = {
    structureName: 'Café Bon Accueil',
    structureType: 'restaurant',
    contactFirstName: 'Ama',
    contactLastName: 'Koffi',
    phoneNumber: '+228 90 00 00 00',
    location: 'Lomé, Agoè',
    description: 'Restaurant familial cherchant des étudiants pour le service.',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RecruiterProfileApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getProfile() GETs /recruiters/me/profile and returns RecruiterProfile', () => {
    let result: RecruiterProfile | undefined;

    service.getProfile().subscribe((response) => (result = response));

    const req = httpMock.expectOne(`${baseUrl}/profile`);
    expect(req.request.method).toBe('GET');
    req.flush(profile);

    expect(result).toEqual(profile);
  });

  it('upsertProfile() PUTs the RecruiterProfileUpsertRequest body to /recruiters/me/profile and returns RecruiterProfile', () => {
    let result: RecruiterProfile | undefined;

    service.upsertProfile(upsertRequest).subscribe((response) => (result = response));

    const req = httpMock.expectOne(`${baseUrl}/profile`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(upsertRequest);
    req.flush(profile);

    expect(result).toEqual(profile);
  });
});
