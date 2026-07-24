import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { Observable, of, Subject, throwError } from 'rxjs';

import { ApplicationsApiService } from '../../data/applications-api.service';
import { StudentApplication } from '../../data/applications.types';
import { ApplicationDetail } from './application-detail';

function buildApplication(overrides: Partial<StudentApplication> = {}): StudentApplication {
  return {
    id: 'app-1',
    offer: {
      id: 'offer-1',
      title: 'Serveur en salle',
      opportunityType: 'job_vacances',
      structureName: 'Le Bon Coin Resto',
    },
    status: 'pending_moderation',
    message: 'Disponible tous les week-ends.',
    rejectionReason: null,
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
    ...overrides,
  };
}

function buildErrorResponse(status: number, error: string, message: string): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    error: {
      statusCode: status,
      error,
      message,
      timestamp: '2026-07-16T00:00:00.000Z',
      path: '/students/me/applications/app-1',
    },
  });
}

describe('ApplicationDetail', () => {
  let fixture: ComponentFixture<ApplicationDetail>;
  let applicationsApiMock: {
    getApplication: ReturnType<typeof vi.fn>;
    accept: ReturnType<typeof vi.fn>;
    decline: ReturnType<typeof vi.fn>;
    withdraw: ReturnType<typeof vi.fn>;
  };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };

  async function setup(
    options: {
      applicationId?: string;
      application?: StudentApplication;
      detailResponse?: Observable<StudentApplication>;
    } = {},
  ): Promise<void> {
    const applicationId = options.applicationId ?? 'app-1';

    applicationsApiMock = {
      getApplication: vi
        .fn()
        .mockReturnValue(
          options.detailResponse ??
            of(options.application ?? buildApplication({ id: applicationId })),
        ),
      accept: vi.fn(),
      decline: vi.fn(),
      withdraw: vi.fn(),
    };
    routerMock = { navigate: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [ApplicationDetail],
      providers: [
        provideNoopAnimations(),
        provideTanStackQuery(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
        { provide: ApplicationsApiService, useValue: applicationsApiMock },
        { provide: Router, useValue: routerMock },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ applicationId })) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ApplicationDetail);
    fixture.detectChanges();
  }

  function query<T extends Element = Element>(selector: string): T {
    return fixture.nativeElement.querySelector(selector) as T;
  }

  async function waitForDetailLoaded(): Promise<void> {
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('mat-card')).not.toBeNull();
    });
  }

  it('creates the component', async () => {
    await setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('requests the detail with the applicationId read from the route', async () => {
    await setup({ applicationId: 'app-77' });

    await vi.waitFor(() => {
      expect(applicationsApiMock.getApplication).toHaveBeenCalledWith('app-77');
    });
  });

  it('shows a loading spinner while the detail query is pending', async () => {
    await setup({ detailResponse: new Subject<StudentApplication>() });

    expect(fixture.nativeElement.textContent).toContain('Chargement de la candidature');
  });

  it("shows the backend's translated message when the detail query fails (e.g. 404 not found)", async () => {
    await setup({
      detailResponse: throwError(() =>
        buildErrorResponse(404, 'APPLICATION_NOT_FOUND', 'Cette candidature est introuvable.'),
      ),
    });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Cette candidature est introuvable.');
    });
  });

  it('renders offer title, structure name, status, message and dates', async () => {
    await setup({
      application: buildApplication({
        offer: {
          id: 'offer-1',
          title: 'Serveur en salle',
          opportunityType: 'job_vacances',
          structureName: 'Le Bon Coin Resto',
        },
        status: 'forwarded',
        message: 'Disponible tous les week-ends.',
        createdAt: '2026-07-10T00:00:00.000Z',
        updatedAt: '2026-07-16T00:00:00.000Z',
      }),
    });
    await waitForDetailLoaded();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Serveur en salle');
    expect(text).toContain('Le Bon Coin Resto');
    expect(text).toContain('Transmise au recruteur');
    expect(text).toContain('Disponible tous les week-ends.');
    expect(text).toContain('10/07/2026');
    expect(text).toContain('16/07/2026');
  });

  it('shows the rejection reason only when the status is rejected_moderation', async () => {
    await setup({
      application: buildApplication({
        status: 'rejected_moderation',
        rejectionReason: 'Profil incomplet',
      }),
    });
    await waitForDetailLoaded();

    expect(fixture.nativeElement.textContent).toContain('Profil incomplet');
  });

  it('hides the "mise en relation" actions when the status is not selected', async () => {
    await setup({ application: buildApplication({ status: 'forwarded' }) });
    await waitForDetailLoaded();

    expect(query('#accept-button')).toBeNull();
    expect(query('#decline-button')).toBeNull();
  });

  it('shows the "mise en relation" actions when the status is selected', async () => {
    await setup({ application: buildApplication({ status: 'selected' }) });
    await waitForDetailLoaded();

    expect(query('#accept-button')).not.toBeNull();
    expect(query('#decline-button')).not.toBeNull();
  });

  it('accepts the mise en relation with the current applicationId', async () => {
    await setup({ applicationId: 'app-5', application: buildApplication({ id: 'app-5', status: 'selected' }) });
    await waitForDetailLoaded();
    applicationsApiMock.accept.mockReturnValue(of(buildApplication({ status: 'accepted' })));

    query<HTMLButtonElement>('#accept-button').click();

    await vi.waitFor(() => {
      expect(applicationsApiMock.accept).toHaveBeenCalledWith('app-5');
    });
  });

  it('shows the translated error message when accepting fails (409 APPLICATION_INVALID_STATE)', async () => {
    await setup({ application: buildApplication({ status: 'selected' }) });
    await waitForDetailLoaded();
    applicationsApiMock.accept.mockReturnValue(
      throwError(() =>
        buildErrorResponse(409, 'APPLICATION_INVALID_STATE', 'Cette candidature a déjà été traitée.'),
      ),
    );

    query<HTMLButtonElement>('#accept-button').click();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Cette candidature a déjà été traitée.');
    });
  });

  it('declines the mise en relation with the current applicationId', async () => {
    await setup({ applicationId: 'app-5', application: buildApplication({ id: 'app-5', status: 'selected' }) });
    await waitForDetailLoaded();
    applicationsApiMock.decline.mockReturnValue(of(buildApplication({ status: 'declined' })));

    query<HTMLButtonElement>('#decline-button').click();

    await vi.waitFor(() => {
      expect(applicationsApiMock.decline).toHaveBeenCalledWith('app-5');
    });
  });

  it('shows the withdraw action for a non-terminal status', async () => {
    await setup({ application: buildApplication({ status: 'pending_moderation' }) });
    await waitForDetailLoaded();

    expect(query('#show-withdraw-button')).not.toBeNull();
  });

  it('hides the withdraw action for a terminal status', async () => {
    await setup({ application: buildApplication({ status: 'accepted' }) });
    await waitForDetailLoaded();

    expect(query('#show-withdraw-button')).toBeNull();
  });

  it('shows a confirmation panel before withdrawing, and cancelling does not call the mutation', async () => {
    await setup({ application: buildApplication({ status: 'forwarded' }) });
    await waitForDetailLoaded();

    query<HTMLButtonElement>('#show-withdraw-button').click();
    fixture.detectChanges();
    expect(query('#confirm-withdraw-button')).not.toBeNull();

    query<HTMLButtonElement>('#cancel-withdraw-button').click();
    fixture.detectChanges();

    expect(query('#confirm-withdraw-button')).toBeNull();
    expect(applicationsApiMock.withdraw).not.toHaveBeenCalled();
  });

  it('withdraws the application with the current applicationId after confirmation and navigates to the applications list', async () => {
    await setup({ applicationId: 'app-5', application: buildApplication({ id: 'app-5', status: 'forwarded' }) });
    await waitForDetailLoaded();
    applicationsApiMock.withdraw.mockReturnValue(of(undefined));

    query<HTMLButtonElement>('#show-withdraw-button').click();
    fixture.detectChanges();
    query<HTMLButtonElement>('#confirm-withdraw-button').click();

    await vi.waitFor(() => {
      expect(applicationsApiMock.withdraw).toHaveBeenCalledWith('app-5');
      expect(routerMock.navigate).toHaveBeenCalledWith(['/etudiant/candidatures']);
    });
  });

  it('shows the translated error message when withdrawing fails (409 APPLICATION_NOT_WITHDRAWABLE), without navigating', async () => {
    await setup({ application: buildApplication({ status: 'forwarded' }) });
    await waitForDetailLoaded();
    applicationsApiMock.withdraw.mockReturnValue(
      throwError(() =>
        buildErrorResponse(
          409,
          'APPLICATION_NOT_WITHDRAWABLE',
          'Cette candidature ne peut plus être retirée.',
        ),
      ),
    );

    query<HTMLButtonElement>('#show-withdraw-button').click();
    fixture.detectChanges();
    query<HTMLButtonElement>('#confirm-withdraw-button').click();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        'Cette candidature ne peut plus être retirée.',
      );
    });
    expect(routerMock.navigate).not.toHaveBeenCalled();
  });
});
