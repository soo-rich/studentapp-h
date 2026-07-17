import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { AuthApiService } from './auth-api.service';
import { AuthResponse, AuthTokens, LoginRequest, RegisterRequest, User } from './auth.types';

describe('AuthApiService', () => {
  let service: AuthApiService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiBaseUrl}/auth`;

  const user: User = {
    id: 'user-1',
    email: 'etudiant@example.com',
    role: 'etudiant',
    verificationStatus: 'pending',
    verificationRejectionReason: null,
    createdAt: '2026-07-16T00:00:00.000Z',
  };

  const tokens: AuthTokens = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresIn: 900,
  };

  const authResponse: AuthResponse = { user, tokens };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('register() POSTs the payload to /auth/register and returns AuthResponse', () => {
    const payload: RegisterRequest = {
      email: 'etudiant@example.com',
      password: 'password123',
      role: 'etudiant',
    };
    let result: AuthResponse | undefined;

    service.register(payload).subscribe((response) => (result = response));

    const req = httpMock.expectOne(`${baseUrl}/register`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(authResponse, { status: 201, statusText: 'Created' });

    expect(result).toEqual(authResponse);
  });

  it('login() POSTs the payload to /auth/login and returns AuthResponse', () => {
    const payload: LoginRequest = {
      email: 'etudiant@example.com',
      password: 'password123',
    };
    let result: AuthResponse | undefined;

    service.login(payload).subscribe((response) => (result = response));

    const req = httpMock.expectOne(`${baseUrl}/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(authResponse);

    expect(result).toEqual(authResponse);
  });

  it('refresh() POSTs { refreshToken } to /auth/refresh and returns AuthTokens', () => {
    let result: AuthTokens | undefined;

    service.refresh('old-refresh-token').subscribe((response) => (result = response));

    const req = httpMock.expectOne(`${baseUrl}/refresh`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ refreshToken: 'old-refresh-token' });
    req.flush(tokens);

    expect(result).toEqual(tokens);
  });

  it('logout() POSTs to /auth/logout with a Bearer header and no body', () => {
    let completed = false;

    service.logout('access-token').subscribe({
      complete: () => (completed = true),
    });

    const req = httpMock.expectOne(`${baseUrl}/logout`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-token');
    expect(req.request.body).toBeNull();
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  it('me() GETs /auth/me with a Bearer header and returns User', () => {
    let result: User | undefined;

    service.me('access-token').subscribe((response) => (result = response));

    const req = httpMock.expectOne(`${baseUrl}/me`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-token');
    req.flush(user);

    expect(result).toEqual(user);
  });
});
