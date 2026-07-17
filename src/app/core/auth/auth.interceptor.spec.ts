import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';

import { environment } from '../../../environments/environment';
import { authInterceptor } from './auth.interceptor';
import { SessionService } from './session.service';

// NOTE — filtrage par origine (`environment.apiBaseUrl`, PAS les autres origines) : non
// couvert ici. Le système de test unitaire Angular (`@angular/build:unit-test`, vitest)
// interdit explicitement `vi.mock` sur des imports relatifs locaux ("use Angular TestBed
// for mocking dependencies"), et `environment.apiBaseUrl` vaut `''` dans ce build de test
// (pas de fileReplacement `development` sur la cible `test`, voir angular.json) : toute
// chaîne "commence" trivialement par `''` (`String.prototype.startsWith('')` vaut toujours
// `true`), donc aucune URL "d'une autre origine" n'est constructible pour démontrer
// l'exclusion. Le comportement reste implémenté (voir `auth.interceptor.ts`) et exercé
// manuellement dès que `environment.apiBaseUrl` est renseigné (déjà le cas en
// développement, `environment.development.ts`).
const apiBaseUrl = environment.apiBaseUrl;

describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let sessionServiceMock: {
    accessToken: ReturnType<typeof vi.fn>;
    refreshAccessToken: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    sessionServiceMock = {
      accessToken: vi.fn().mockReturnValue(null),
      refreshAccessToken: vi.fn(),
      clear: vi.fn(),
    };
    routerMock = { navigate: vi.fn().mockResolvedValue(true) };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: SessionService, useValue: sessionServiceMock },
        { provide: Router, useValue: routerMock },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('adds an Authorization: Bearer header to API requests when an access token is present', () => {
    sessionServiceMock.accessToken.mockReturnValue('access-token-1');

    httpClient.get(`${apiBaseUrl}/students/me`).subscribe();

    const req = httpMock.expectOne(`${apiBaseUrl}/students/me`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-token-1');
    req.flush({});
  });

  it('does not add an Authorization header when no access token is present', () => {
    sessionServiceMock.accessToken.mockReturnValue(null);

    httpClient.get(`${apiBaseUrl}/students/me`).subscribe();

    const req = httpMock.expectOne(`${apiBaseUrl}/students/me`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('does not add an Authorization header to /auth/login, /auth/register or /auth/refresh', () => {
    sessionServiceMock.accessToken.mockReturnValue('access-token-1');

    const publicPaths = ['/auth/login', '/auth/register', '/auth/refresh'];

    for (const path of publicPaths) {
      httpClient.post(`${apiBaseUrl}${path}`, {}).subscribe();

      const req = httpMock.expectOne(`${apiBaseUrl}${path}`);
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush({});
    }
  });

  it('refreshes the access token once on a 401 and retries the original request with the new token', async () => {
    sessionServiceMock.accessToken
      .mockReturnValueOnce('expired-token') // requête initiale
      .mockReturnValueOnce('new-token'); // requête rejouée après refresh
    sessionServiceMock.refreshAccessToken.mockReturnValue(of(true));

    const resultPromise = firstValueFrom(httpClient.get(`${apiBaseUrl}/students/me`));

    const firstReq = httpMock.expectOne(`${apiBaseUrl}/students/me`);
    expect(firstReq.request.headers.get('Authorization')).toBe('Bearer expired-token');
    firstReq.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    const retriedReq = httpMock.expectOne(`${apiBaseUrl}/students/me`);
    expect(retriedReq.request.headers.get('Authorization')).toBe('Bearer new-token');
    retriedReq.flush({ ok: true });

    await expect(resultPromise).resolves.toEqual({ ok: true });
    expect(sessionServiceMock.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(sessionServiceMock.clear).not.toHaveBeenCalled();
    expect(routerMock.navigate).not.toHaveBeenCalled();
  });

  it('clears the session and redirects to "/" when the refresh fails on a 401, without retrying', async () => {
    sessionServiceMock.accessToken.mockReturnValue('expired-token');
    sessionServiceMock.refreshAccessToken.mockReturnValue(of(false));

    const resultPromise = firstValueFrom(httpClient.get(`${apiBaseUrl}/students/me`));

    const req = httpMock.expectOne(`${apiBaseUrl}/students/me`);
    req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    await expect(resultPromise).rejects.toMatchObject({ status: 401 });
    expect(sessionServiceMock.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(sessionServiceMock.clear).toHaveBeenCalledTimes(1);
    expect(routerMock.navigate).toHaveBeenCalledWith(['/']);
    httpMock.expectNone(`${apiBaseUrl}/students/me`);
  });

  it('does not attempt a second refresh when the retried request also returns a 401 (no loop)', async () => {
    sessionServiceMock.accessToken.mockReturnValue('expired-token');
    sessionServiceMock.refreshAccessToken.mockReturnValue(of(true));

    const resultPromise = firstValueFrom(httpClient.get(`${apiBaseUrl}/students/me`));

    const firstReq = httpMock.expectOne(`${apiBaseUrl}/students/me`);
    firstReq.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    const retriedReq = httpMock.expectOne(`${apiBaseUrl}/students/me`);
    retriedReq.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    await expect(resultPromise).rejects.toMatchObject({ status: 401 });
    expect(sessionServiceMock.refreshAccessToken).toHaveBeenCalledTimes(1);
    httpMock.expectNone(`${apiBaseUrl}/students/me`);
  });

  it('does not attempt a refresh and lets non-401 errors pass through unmodified', async () => {
    sessionServiceMock.accessToken.mockReturnValue('access-token-1');

    const resultPromise = firstValueFrom(httpClient.get(`${apiBaseUrl}/students/me`));

    const req = httpMock.expectOne(`${apiBaseUrl}/students/me`);
    req.flush({ message: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });

    await expect(resultPromise).rejects.toMatchObject({ status: 500 });
    expect(sessionServiceMock.refreshAccessToken).not.toHaveBeenCalled();
    expect(sessionServiceMock.clear).not.toHaveBeenCalled();
  });
});
