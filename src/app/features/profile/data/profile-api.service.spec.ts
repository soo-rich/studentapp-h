import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { ProfileApiService } from './profile-api.service';
import { StudentProfile, StudentProfileUpsertRequest } from './profile.types';

describe('ProfileApiService', () => {
  let service: ProfileApiService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiBaseUrl}/students/me`;

  const profile: StudentProfile = {
    userId: 'user-1',
    firstName: 'Ama',
    lastName: 'Koffi',
    phoneNumber: '+228 90 00 00 00',
    university: 'Université de Lomé',
    studentCardNumber: 'UL-2026-001',
    fieldOfStudy: 'Informatique',
    studyLevel: 'Licence 3',
    skills: ['JavaScript', 'Gestion de projet'],
    experiences: null,
    languages: ['Français', 'Ewe'],
    residenceLocation: 'Lomé, Agoè',
    opportunityTypes: ['temps_partiel', 'stage'],
    availabilitySlots: [{ dayOfWeek: 'lundi', startTime: '08:00', endTime: '12:00' }],
    housingSituation: 'avec_parents_tuteurs',
    hasDisability: false,
    disabilityDescription: null,
    allergies: null,
    sensitiveDataConsent: true,
    sensitiveDataConsentAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
  };

  const upsertRequest: StudentProfileUpsertRequest = {
    firstName: 'Ama',
    lastName: 'Koffi',
    phoneNumber: '+228 90 00 00 00',
    university: 'Université de Lomé',
    studentCardNumber: 'UL-2026-001',
    fieldOfStudy: 'Informatique',
    studyLevel: 'Licence 3',
    skills: ['JavaScript', 'Gestion de projet'],
    languages: ['Français', 'Ewe'],
    residenceLocation: 'Lomé, Agoè',
    opportunityTypes: ['temps_partiel', 'stage'],
    availabilitySlots: [{ dayOfWeek: 'lundi', startTime: '08:00', endTime: '12:00' }],
    sensitiveDataConsent: true,
    housingSituation: 'avec_parents_tuteurs',
    hasDisability: false,
    disabilityDescription: null,
    allergies: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProfileApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getProfile() GETs /students/me/profile and returns StudentProfile', () => {
    let result: StudentProfile | undefined;

    service.getProfile().subscribe((response) => (result = response));

    const req = httpMock.expectOne(`${baseUrl}/profile`);
    expect(req.request.method).toBe('GET');
    req.flush(profile);

    expect(result).toEqual(profile);
  });

  it('upsertProfile() PUTs the StudentProfileUpsertRequest body to /students/me/profile and returns StudentProfile', () => {
    let result: StudentProfile | undefined;

    service.upsertProfile(upsertRequest).subscribe((response) => (result = response));

    const req = httpMock.expectOne(`${baseUrl}/profile`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(upsertRequest);
    req.flush(profile);

    expect(result).toEqual(profile);
  });
});
