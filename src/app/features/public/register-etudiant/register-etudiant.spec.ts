import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { of, Subject, throwError } from 'rxjs';

import { AuthApiService } from '../../../core/auth/auth-api.service';
import { AuthResponse } from '../../../core/auth/auth.types';
import { SessionService } from '../../../core/auth/session.service';
import { RegisterEtudiant } from './register-etudiant';

/** Simule une frappe utilisateur dans un `<input>` piloté par `formControlName`. */
function setInputValue(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('RegisterEtudiant', () => {
  let fixture: ComponentFixture<RegisterEtudiant>;
  let authApiMock: { register: ReturnType<typeof vi.fn> };
  let sessionServiceMock: { setSession: ReturnType<typeof vi.fn> };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };

  const authResponse: AuthResponse = {
    user: {
      id: 'user-1',
      email: 'etudiant@example.com',
      role: 'etudiant',
      verificationStatus: 'pending',
      verificationRejectionReason: null,
      createdAt: '2026-07-16T00:00:00.000Z',
    },
    tokens: {
      accessToken: 'access-token-1',
      refreshToken: 'refresh-token-1',
      expiresIn: 900,
    },
  };

  beforeEach(async () => {
    authApiMock = { register: vi.fn() };
    sessionServiceMock = { setSession: vi.fn() };
    routerMock = { navigate: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [RegisterEtudiant],
      providers: [
        provideNoopAnimations(),
        provideTanStackQuery(new QueryClient()),
        { provide: AuthApiService, useValue: authApiMock },
        { provide: SessionService, useValue: sessionServiceMock },
        { provide: Router, useValue: routerMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterEtudiant);
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

  it('rejects an invalid email and does not call the mutation', () => {
    setInputValue(getEmailInput(), 'not-an-email');
    setInputValue(getPasswordInput(), 'password123');

    submitForm();

    expect(authApiMock.register).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain("Le format de l'email est invalide.");
  });

  it('rejects a password shorter than 8 characters and does not call the mutation', () => {
    setInputValue(getEmailInput(), 'etudiant@example.com');
    setInputValue(getPasswordInput(), '1234567');

    submitForm();

    expect(authApiMock.register).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      'Le mot de passe doit contenir au moins 8 caractères.',
    );
  });

  it('does not call the mutation when both fields are empty and shows required errors', () => {
    submitForm();

    expect(authApiMock.register).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain("L'email est requis.");
    expect(fixture.nativeElement.textContent).toContain('Le mot de passe est requis.');
  });

  it('submits {email, password, role: "etudiant"}, then sets the session and navigates to /etudiant on success', async () => {
    authApiMock.register.mockReturnValue(of(authResponse));

    setInputValue(getEmailInput(), 'etudiant@example.com');
    setInputValue(getPasswordInput(), 'password123');

    submitForm();

    await vi.waitFor(() => {
      expect(sessionServiceMock.setSession).toHaveBeenCalledWith(authResponse);
    });

    expect(authApiMock.register).toHaveBeenCalledWith({
      email: 'etudiant@example.com',
      password: 'password123',
      role: 'etudiant',
    });
    expect(routerMock.navigate).toHaveBeenCalledWith(['/etudiant']);
  });

  it('shows the translated ErrorResponse.message on a 409 (email already taken) without setting a session or navigating', async () => {
    const errorResponse = new HttpErrorResponse({
      status: 409,
      error: {
        statusCode: 409,
        error: 'AUTH_EMAIL_TAKEN',
        message: 'Cet email est déjà utilisé.',
        timestamp: '2026-07-16T00:00:00.000Z',
        path: '/auth/register',
      },
    });
    authApiMock.register.mockReturnValue(throwError(() => errorResponse));

    setInputValue(getEmailInput(), 'etudiant@example.com');
    setInputValue(getPasswordInput(), 'password123');

    submitForm();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    });

    expect(fixture.nativeElement.textContent).toContain('Cet email est déjà utilisé.');
    expect(sessionServiceMock.setSession).not.toHaveBeenCalled();
    expect(routerMock.navigate).not.toHaveBeenCalled();
  });

  it('shows the translated ErrorResponse.message on a 422 (validation error)', async () => {
    const errorResponse = new HttpErrorResponse({
      status: 422,
      error: {
        statusCode: 422,
        error: 'VALIDATION_ERROR',
        message: 'Le mot de passe doit contenir au moins 8 caractères.',
        timestamp: '2026-07-16T00:00:00.000Z',
        path: '/auth/register',
      },
    });
    authApiMock.register.mockReturnValue(throwError(() => errorResponse));

    setInputValue(getEmailInput(), 'etudiant@example.com');
    setInputValue(getPasswordInput(), 'password123');

    submitForm();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    });

    expect(fixture.nativeElement.textContent).toContain(
      'Le mot de passe doit contenir au moins 8 caractères.',
    );
    expect(sessionServiceMock.setSession).not.toHaveBeenCalled();
    expect(routerMock.navigate).not.toHaveBeenCalled();
  });

  it('falls back to a generic message when the error body has no translated message (e.g. network failure)', async () => {
    authApiMock.register.mockReturnValue(throwError(() => new Error('network down')));

    setInputValue(getEmailInput(), 'etudiant@example.com');
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

  it('disables the submit button while the mutation is pending', async () => {
    const register$ = new Subject<AuthResponse>();
    authApiMock.register.mockReturnValue(register$);

    setInputValue(getEmailInput(), 'etudiant@example.com');
    setInputValue(getPasswordInput(), 'password123');

    submitForm();

    const submitButton = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(submitButton.disabled).toBe(true);
    });

    register$.next(authResponse);
    register$.complete();

    await vi.waitFor(() => {
      expect(sessionServiceMock.setSession).toHaveBeenCalled();
    });
  });
});
