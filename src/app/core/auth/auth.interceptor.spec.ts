import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';

import { environment } from '../../../environments/environment';
import { authInterceptor } from './auth.interceptor';
import { SessionService } from './session.service';

// `environment.apiBaseUrl` vaut `''` dans ce build de test (pas de fileReplacement
// `development` sur la cible `test`, voir angular.json) : les requêtes vers l'API sont donc
// émises en URL RELATIVE ci-dessous (ex. `/students/me`), exactement comme en développement
// derrière `proxy.conf.js`. C'est ce chemin de code (`isApiRequest` avec `apiBaseUrl` vide,
// filtrage par `API_PATH_PREFIXES`) qui est exercé par la majorité des tests de ce fichier ;
// le test "third-party origin" ci-dessous couvre spécifiquement le cas qui a motivé le
// correctif : `url.startsWith(environment.apiBaseUrl)` seul, avec `apiBaseUrl === ''`, vaut
// TOUJOURS `true` (`String.prototype.startsWith('')` est trivialement vrai) et attacherait le
// Bearer token à N'IMPORTE QUELLE origine — c'est la fuite de token corrigée par cette tâche.
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

  // Test de non-régression de la fuite de token : `apiBaseUrl` vaut `''` ici, donc
  // `url.startsWith(environment.apiBaseUrl)` seul (l'ancienne implémentation bogguée) vaudrait
  // toujours `true`, y compris pour cette URL absolue vers une origine tierce, et attacherait
  // le Bearer token à une requête qui ne va pas du tout vers `studentapi`. MUTATION : si on
  // restaure `isApiRequest` à `url.startsWith(environment.apiBaseUrl)` seul, ce test rougit.
  it('never adds an Authorization header to a request targeting a third-party absolute origin', () => {
    sessionServiceMock.accessToken.mockReturnValue('access-token-1');

    httpClient.get('https://tiers.example/collecte').subscribe();

    const req = httpMock.expectOne('https://tiers.example/collecte');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  // Fige l'ANCRAGE du filtrage par préfixe. Les deux URLs ci-dessous contiennent un préfixe
  // d'API connu, mais jamais en tête : un matching par sous-chaîne (`includes`) ou un
  // relâchement de l'ancrage les traiterait comme des requêtes API et enverrait le token à
  // un tiers. Sans ce test, une mutation `startsWith` -> `includes` passait inaperçue (trou
  // de couverture relevé en validation de T20).
  it.each([
    'https://evil.example/x/auth/y', // préfixe connu, mais en position non-initiale
    '//evil.example/auth', // protocol-relative : résolue vers une AUTRE origine par le navigateur
  ])('never adds an Authorization header to the decoy URL %s', (url) => {
    sessionServiceMock.accessToken.mockReturnValue('access-token-1');

    httpClient.get(url).subscribe();

    const req = httpMock.expectOne(url);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  // Couvre chaque préfixe connu de `API_PATH_PREFIXES` (contrat `studentapi` v0.3.0) en URL
  // RELATIVE (comportement réel en développement derrière `proxy.conf.js`, `apiBaseUrl` vide).
  // MUTATION : retirer un de ces préfixes de `API_PATH_PREFIXES` fait rougir l'itération
  // correspondante (le header `Authorization` disparaît pour ce préfixe).
  it.each([
    '/auth/me',
    '/students/me/profile',
    '/moderation/verifications',
    '/verification/documents',
  ])('adds an Authorization header to a relative request under the known API prefix %s', (path) => {
    sessionServiceMock.accessToken.mockReturnValue('access-token-1');

    httpClient.get(path).subscribe();

    const req = httpMock.expectOne(path);
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-token-1');
    req.flush({});
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
