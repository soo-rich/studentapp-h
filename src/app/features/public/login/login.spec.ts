import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { of, Subject, throwError } from 'rxjs';

import { AuthApiService } from '../../../core/auth/auth-api.service';
import { AuthResponse, Role, User } from '../../../core/auth/auth.types';
import { SessionService } from '../../../core/auth/session.service';
import { Login } from './login';

/** Simule une frappe utilisateur dans un `<input>` piloté par `formControlName`. */
function setInputValue(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let authApiMock: { login: ReturnType<typeof vi.fn> };
  let sessionServiceMock: { setSession: ReturnType<typeof vi.fn> };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };

  const tokens = {
    accessToken: 'access-token-1',
    refreshToken: 'refresh-token-1',
    expiresIn: 900,
  };

  const authResponseFor = (role: Role): AuthResponse => {
    const user: User = {
      id: `user-${role}`,
      email: 'user@example.com',
      role,
      verificationStatus: 'pending',
      verificationRejectionReason: null,
      createdAt: '2026-07-16T00:00:00.000Z',
    };
    return { user, tokens };
  };

  beforeEach(async () => {
    authApiMock = { login: vi.fn() };
    sessionServiceMock = { setSession: vi.fn() };
    routerMock = { navigate: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideNoopAnimations(),
        provideTanStackQuery(new QueryClient()),
        { provide: AuthApiService, useValue: authApiMock },
        { provide: SessionService, useValue: sessionServiceMock },
        { provide: Router, useValue: routerMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
  });

  function getEmailInput(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input[type="email"]') as HTMLInputElement;
  }

  function getPasswordInput(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input[type="password"]') as HTMLInputElement;
  }

  function submitForm(): void {
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  }

  it('creates the component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  describe('form validity', () => {
    it('does not call the mutation when both fields are empty and shows required errors', () => {
      submitForm();

      expect(authApiMock.login).not.toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).toContain("L'email est requis.");
      expect(fixture.nativeElement.textContent).toContain('Le mot de passe est requis.');
    });

    it('rejects an invalid email format and does not call the mutation', () => {
      setInputValue(getEmailInput(), 'not-an-email');
      setInputValue(getPasswordInput(), 'password123');

      submitForm();

      expect(authApiMock.login).not.toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).toContain("Le format de l'email est invalide.");
    });

    it('calls the mutation with {email, password} when the form is valid', async () => {
      authApiMock.login.mockReturnValue(of(authResponseFor('etudiant')));

      setInputValue(getEmailInput(), 'etudiant@example.com');
      setInputValue(getPasswordInput(), 'password123');

      submitForm();

      await vi.waitFor(() => {
        expect(authApiMock.login).toHaveBeenCalledWith({
          email: 'etudiant@example.com',
          password: 'password123',
        });
      });
    });
  });

  describe('successful login redirects by role', () => {
    const cases: Array<[Role, string]> = [
      ['etudiant', '/etudiant'],
      ['recruteur', '/recruteur'],
      ['moderateur', '/moderation'],
    ];

    for (const [role, expectedPath] of cases) {
      it(`sets the session and navigates to "${expectedPath}" when the API returns role "${role}"`, async () => {
        const authResponse = authResponseFor(role);
        authApiMock.login.mockReturnValue(of(authResponse));

        setInputValue(getEmailInput(), 'user@example.com');
        setInputValue(getPasswordInput(), 'password123');

        submitForm();

        await vi.waitFor(() => {
          expect(sessionServiceMock.setSession).toHaveBeenCalledWith(authResponse);
        });
        expect(routerMock.navigate).toHaveBeenCalledWith([expectedPath]);
      });
    }
  });

  it('shows the translated ErrorResponse.message on a 401 (invalid credentials) without setting a session or navigating', async () => {
    const errorResponse = new HttpErrorResponse({
      status: 401,
      error: {
        statusCode: 401,
        error: 'AUTH_INVALID_CREDENTIALS',
        message: 'Identifiants invalides.',
        timestamp: '2026-07-16T00:00:00.000Z',
        path: '/auth/login',
      },
    });
    authApiMock.login.mockReturnValue(throwError(() => errorResponse));

    setInputValue(getEmailInput(), 'user@example.com');
    setInputValue(getPasswordInput(), 'wrong-password');

    submitForm();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    });

    expect(fixture.nativeElement.textContent).toContain('Identifiants invalides.');
    expect(sessionServiceMock.setSession).not.toHaveBeenCalled();
    expect(routerMock.navigate).not.toHaveBeenCalled();
  });

  it('falls back to a generic message when the error body has no translated message (e.g. network failure)', async () => {
    authApiMock.login.mockReturnValue(throwError(() => new Error('network down')));

    setInputValue(getEmailInput(), 'user@example.com');
    setInputValue(getPasswordInput(), 'password123');

    submitForm();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    });

    expect(fixture.nativeElement.textContent).toContain(
      'Une erreur est survenue. Réessaie dans un instant.',
    );
  });

  it('disables the submit button and shows a loading state while the mutation is pending', async () => {
    const login$ = new Subject<AuthResponse>();
    authApiMock.login.mockReturnValue(login$);

    setInputValue(getEmailInput(), 'etudiant@example.com');
    setInputValue(getPasswordInput(), 'password123');

    submitForm();

    const submitButton = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(submitButton.disabled).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('Connexion…');
    });

    login$.next(authResponseFor('etudiant'));
    login$.complete();

    await vi.waitFor(() => {
      expect(sessionServiceMock.setSession).toHaveBeenCalled();
    });
  });
});
