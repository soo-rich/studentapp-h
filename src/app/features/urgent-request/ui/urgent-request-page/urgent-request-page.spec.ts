import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { Observable, of, Subject, throwError } from 'rxjs';

import { UrgentRequestApiService } from '../../data/urgent-request-api.service';
import { UrgentRequest } from '../../data/urgent-request.types';
import { UrgentRequestPage } from './urgent-request-page';

function buildUrgentRequest(overrides: Partial<UrgentRequest> = {}): UrgentRequest {
  return {
    id: 'urgent-1',
    status: 'pending',
    message: "J'ai besoin d'aide en urgence pour un logement.",
    moderatorNote: null,
    createdAt: '2026-07-16T00:00:00.000Z',
    reviewedAt: null,
    ...overrides,
  };
}

function notFoundError(): HttpErrorResponse {
  return new HttpErrorResponse({
    status: 404,
    error: {
      statusCode: 404,
      error: 'URGENT_REQUEST_NOT_FOUND',
      message: "Aucune demande d'urgence en cours.",
      timestamp: '2026-07-16T00:00:00.000Z',
      path: '/students/me/urgent-request',
    },
  });
}

describe('UrgentRequestPage', () => {
  let fixture: ComponentFixture<UrgentRequestPage>;
  let apiMock: {
    getUrgentRequest: ReturnType<typeof vi.fn>;
    createUrgentRequest: ReturnType<typeof vi.fn>;
  };

  async function setup(
    options: {
      getResponse?: Observable<UrgentRequest>;
    } = {},
  ): Promise<void> {
    apiMock = {
      getUrgentRequest: vi
        .fn()
        .mockReturnValue(options.getResponse ?? throwError(() => notFoundError())),
      createUrgentRequest: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [UrgentRequestPage],
      providers: [
        provideNoopAnimations(),
        provideTanStackQuery(
          new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } }),
        ),
        { provide: UrgentRequestApiService, useValue: apiMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UrgentRequestPage);
    fixture.detectChanges();
  }

  function query<T extends Element = Element>(selector: string): T {
    return fixture.nativeElement.querySelector(selector) as T;
  }

  /**
   * Attend que la query ait résolu (succès ou erreur) — elle résout de façon asynchrone
   * (TanStack Query), un simple `detectChanges()` juste après `setup()` ne suffit pas à le
   * garantir.
   */
  async function waitForLoaded(): Promise<void> {
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain('Chargement');
    });
  }

  function typeMessage(value: string): void {
    const textarea = query<HTMLTextAreaElement>('textarea');
    textarea.value = value;
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('creates the component', async () => {
    await setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows a loading spinner while the query is pending', async () => {
    await setup({ getResponse: new Subject<UrgentRequest>() });

    expect(fixture.nativeElement.textContent).toContain('Chargement');
  });

  it('shows the form and no status card when there is no existing request (404 not found is the normal case)', async () => {
    await setup();
    await waitForLoaded();

    expect(query('form')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Ta dernière demande');
  });

  it('shows a real error message and no form when the query fails with a non-404 error', async () => {
    const errorResponse = new HttpErrorResponse({
      status: 500,
      error: {
        statusCode: 500,
        error: 'INTERNAL_ERROR',
        message: 'Une erreur serveur est survenue.',
        timestamp: '2026-07-16T00:00:00.000Z',
        path: '/students/me/urgent-request',
      },
    });
    await setup({ getResponse: throwError(() => errorResponse) });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Une erreur serveur est survenue.');
    });
    expect(query('form')).toBeNull();
  });

  it('shows the status and HIDES the form when the latest request is pending', async () => {
    await setup({
      getResponse: of(buildUrgentRequest({ status: 'pending', message: 'Message de détresse.' })),
    });
    await waitForLoaded();

    expect(fixture.nativeElement.textContent).toContain('Ta dernière demande');
    expect(fixture.nativeElement.textContent).toContain("en cours d'examen");
    expect(query('form')).toBeNull();
  });

  it('shows the status, the moderator note, and the form again when the latest request is dismissed', async () => {
    await setup({
      getResponse: of(
        buildUrgentRequest({
          status: 'dismissed',
          moderatorNote: 'Situation déjà résolue avec le service social.',
        }),
      ),
    });
    await waitForLoaded();

    expect(fixture.nativeElement.textContent).toContain('Demande écartée');
    expect(fixture.nativeElement.textContent).toContain(
      'Situation déjà résolue avec le service social.',
    );
    expect(query('form')).not.toBeNull();
  });

  it('shows the status and the form again when the latest request is prioritized', async () => {
    await setup({ getResponse: of(buildUrgentRequest({ status: 'prioritized' })) });
    await waitForLoaded();

    expect(fixture.nativeElement.textContent).toContain('Classée prioritaire');
    expect(query('form')).not.toBeNull();
  });

  it('blocks the submission and shows a validation message when the message is shorter than 10 characters, without calling the mutation', async () => {
    await setup();
    await waitForLoaded();

    typeMessage('short');
    query<HTMLFormElement>('form').dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    // `mutate()` (TanStack Query) dispatche `mutationFn` de façon asynchrone (micro/macrotask) :
    // sans ce flush, l'assertion négative ci-dessous serait vraie AVANT même que le garde-fou
    // ait eu la chance d'être contourné, rendant le test tautologique.
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    expect(apiMock.createUrgentRequest).not.toHaveBeenCalled();
    expect(query('form')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Le message doit contenir au moins 10 caractères.',
    );
  });

  it('shows a character counter that follows the typed message length', async () => {
    await setup();
    await waitForLoaded();

    typeMessage('Douze carac.');

    expect(fixture.nativeElement.textContent).toContain('12 / 1000');
  });

  it('calls the create mutation with the exact {message} payload on a valid submit', async () => {
    await setup();
    await waitForLoaded();
    apiMock.createUrgentRequest.mockReturnValue(of(buildUrgentRequest()));

    const message = "J'ai besoin de parler à quelqu'un rapidement, merci de votre aide.";
    typeMessage(message);

    query<HTMLButtonElement>('#urgent-request-submit-button').click();

    await vi.waitFor(() => {
      expect(apiMock.createUrgentRequest).toHaveBeenCalledWith({ message });
    });
  });

  it('shows a visible confirmation once the request has been submitted successfully', async () => {
    await setup();
    await waitForLoaded();
    apiMock.createUrgentRequest.mockReturnValue(of(buildUrgentRequest()));

    typeMessage('Message suffisamment long pour être valide.');
    query<HTMLButtonElement>('#urgent-request-submit-button').click();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Ta demande a bien été envoyée.');
    });
  });

  it('disables the submit button while the create mutation is pending', async () => {
    await setup();
    await waitForLoaded();
    const create$ = new Subject<UrgentRequest>();
    apiMock.createUrgentRequest.mockReturnValue(create$);

    typeMessage('Message suffisamment long pour être valide.');
    query<HTMLButtonElement>('#urgent-request-submit-button').click();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(query<HTMLButtonElement>('#urgent-request-submit-button').disabled).toBe(true);
    });

    create$.next(buildUrgentRequest());
    create$.complete();
  });

  it('shows the translated 409 message when a request is already pending', async () => {
    await setup();
    await waitForLoaded();
    const alreadyPendingError = new HttpErrorResponse({
      status: 409,
      error: {
        statusCode: 409,
        error: 'URGENT_REQUEST_ALREADY_PENDING',
        message: 'Une demande est déjà en cours de traitement.',
        timestamp: '2026-07-16T00:00:00.000Z',
        path: '/students/me/urgent-request',
      },
    });
    apiMock.createUrgentRequest.mockReturnValue(throwError(() => alreadyPendingError));

    typeMessage('Message suffisamment long pour être valide.');
    query<HTMLButtonElement>('#urgent-request-submit-button').click();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        'Une demande est déjà en cours de traitement.',
      );
    });
  });
});
