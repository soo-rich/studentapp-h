import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';

import { roleGuard } from './role.guard';
import { SessionService } from './session.service';

describe('roleGuard', () => {
  let sessionService: SessionService;
  let router: Router;

  const runGuard = (requiredRole: Parameters<typeof roleGuard>[0]) =>
    TestBed.runInInjectionContext(() =>
      roleGuard(requiredRole)({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
    sessionService = TestBed.inject(SessionService);
    router = TestBed.inject(Router);
  });

  it("blocks access and redirects to '' when the current role does not match", () => {
    sessionService.setRole('recruteur');

    const result = runGuard('etudiant');

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/');
  });

  it('blocks access when there is no current role (visiteur non connecté)', () => {
    const result = runGuard('moderateur');

    expect(result).toBeInstanceOf(UrlTree);
  });

  it('allows access when the current role matches the required role', () => {
    sessionService.setRole('etudiant');

    const result = runGuard('etudiant');

    expect(result).toBe(true);
  });
});
