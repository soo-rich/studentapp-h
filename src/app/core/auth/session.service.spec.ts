import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';

import { AuthApiService } from './auth-api.service';
import { AuthResponse, AuthTokens, User } from './auth.types';
import { REFRESH_TOKEN_STORAGE_KEY, SessionService } from './session.service';

describe('SessionService', () => {
  let service: SessionService;
  let refreshMock: ReturnType<typeof vi.fn>;
  let meMock: ReturnType<typeof vi.fn>;

  const user: User = {
    id: 'user-1',
    email: 'etudiant@example.com',
    role: 'etudiant',
    verificationStatus: 'pending',
    verificationRejectionReason: null,
    createdAt: '2026-07-16T00:00:00.000Z',
  };

  const tokens: AuthTokens = {
    accessToken: 'access-token-1',
    refreshToken: 'refresh-token-1',
    expiresIn: 900,
  };

  const authResponse: AuthResponse = { user, tokens };

  beforeEach(() => {
    localStorage.clear();

    refreshMock = vi.fn();
    meMock = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthApiService,
          useValue: { refresh: refreshMock, me: meMock } as unknown as AuthApiService,
        },
      ],
    });

    service = TestBed.inject(SessionService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('defaults to an unauthenticated session (no user, no token, currentRole null)', () => {
    expect(service.currentUser()).toBeNull();
    expect(service.currentRole()).toBeNull();
    expect(service.accessToken()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('setSession() populates user/role, keeps the access token in memory and persists the refresh token', () => {
    service.setSession(authResponse);

    expect(service.currentUser()).toEqual(user);
    expect(service.currentRole()).toBe('etudiant');
    expect(service.accessToken()).toBe('access-token-1');
    expect(service.isAuthenticated()).toBe(true);
    expect(localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBe('refresh-token-1');
  });

  it("setRole() sets currentRole directly without a full session (role.guard.spec.ts compatibility)", () => {
    service.setRole('recruteur');

    expect(service.currentRole()).toBe('recruteur');
    expect(service.currentUser()).toBeNull();

    service.setRole(null);

    expect(service.currentRole()).toBeNull();
  });

  it('updateTokens() replaces the in-memory access token and persisted refresh token without touching the user', () => {
    service.setSession(authResponse);
    const newTokens: AuthTokens = {
      accessToken: 'access-token-2',
      refreshToken: 'refresh-token-2',
      expiresIn: 900,
    };

    service.updateTokens(newTokens);

    expect(service.accessToken()).toBe('access-token-2');
    expect(service.currentUser()).toEqual(user);
    expect(localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBe('refresh-token-2');
  });

  it('clear() resets user, role and access token, and removes the persisted refresh token', () => {
    service.setSession(authResponse);

    service.clear();

    expect(service.currentUser()).toBeNull();
    expect(service.currentRole()).toBeNull();
    expect(service.accessToken()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('restoreSession() resolves to false without calling the API when no refresh token is persisted', async () => {
    const restored = await firstValueFrom(service.restoreSession());

    expect(restored).toBe(false);
    expect(refreshMock).not.toHaveBeenCalled();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('restoreSession() refreshes the tokens then reloads the current user when a refresh token is persisted', async () => {
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, 'stored-refresh-token');
    refreshMock.mockReturnValue(of(tokens));
    meMock.mockReturnValue(of(user));

    const restored = await firstValueFrom(service.restoreSession());

    expect(restored).toBe(true);
    expect(refreshMock).toHaveBeenCalledWith('stored-refresh-token');
    expect(meMock).toHaveBeenCalledWith(tokens.accessToken);
    expect(service.currentUser()).toEqual(user);
    expect(service.currentRole()).toBe('etudiant');
    expect(service.accessToken()).toBe(tokens.accessToken);
    expect(localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBe(tokens.refreshToken);
  });

  it('restoreSession() clears the session and resolves to false when /auth/refresh fails', async () => {
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, 'stale-refresh-token');
    refreshMock.mockReturnValue(throwError(() => new Error('refresh failed')));

    const restored = await firstValueFrom(service.restoreSession());

    expect(restored).toBe(false);
    expect(meMock).not.toHaveBeenCalled();
    expect(service.currentUser()).toBeNull();
    expect(service.accessToken()).toBeNull();
    expect(localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('restoreSession() clears the session and resolves to false when /auth/me fails after a successful refresh', async () => {
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, 'stored-refresh-token');
    refreshMock.mockReturnValue(of(tokens));
    meMock.mockReturnValue(throwError(() => new Error('me failed')));

    const restored = await firstValueFrom(service.restoreSession());

    expect(restored).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(service.accessToken()).toBeNull();
    expect(localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('refreshAccessToken() updates the in-memory access token and persisted refresh token on success, without reloading the user', async () => {
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, 'stored-refresh-token');
    refreshMock.mockReturnValue(of(tokens));

    const refreshed = await firstValueFrom(service.refreshAccessToken());

    expect(refreshed).toBe(true);
    expect(service.accessToken()).toBe(tokens.accessToken);
    expect(localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBe(tokens.refreshToken);
    expect(meMock).not.toHaveBeenCalled();
  });

  it('refreshAccessToken() resolves to false without clearing the existing session when the API call fails', async () => {
    service.setSession(authResponse);
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, 'stale-refresh-token');
    refreshMock.mockReturnValue(throwError(() => new Error('refresh failed')));

    const refreshed = await firstValueFrom(service.refreshAccessToken());

    expect(refreshed).toBe(false);
    // refreshAccessToken() only reports success/failure: clearing the session on failure
    // is the caller's responsibility (see auth.interceptor.ts).
    expect(service.currentUser()).toEqual(user);
    expect(service.accessToken()).toBe(tokens.accessToken);
  });

  it('refreshAccessToken() resolves to false without calling the API when no refresh token is persisted', async () => {
    const refreshed = await firstValueFrom(service.refreshAccessToken());

    expect(refreshed).toBe(false);
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
