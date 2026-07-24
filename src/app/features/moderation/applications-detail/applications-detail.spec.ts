import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { Observable, of, Subject, throwError } from 'rxjs';

import { ModerationApplicationsApiService } from '../data/moderation-applications-api.service';
import {
  ModerationApplication,
  OfferSummary,
  StudentProfile,
} from '../data/moderation-applications.types';
import { ModerationApplicationsDetail } from './applications-detail';

function buildOffer(overrides: Partial<OfferSummary> = {}): OfferSummary {
  return {
    id: 'offer-1',
    title: 'Vendeur week-end',
    opportunityType: 'temps_partiel',
    structureName: 'Boutique ABC',
    ...overrides,
  };
}

function buildStudent(overrides: Partial<StudentProfile> = {}): StudentProfile {
  return {
    userId: 'user-1',
    firstName: 'Awa',
    lastName: 'Koffi',
    university: 'Université de Lomé',
    studentCardNumber: 'UL-2026-001',
    fieldOfStudy: 'Informatique',
    studyLevel: 'Licence 3',
    skills: ['JavaScript'],
    languages: ['Français'],
    residenceLocation: 'Lomé',
    opportunityTypes: ['temps_partiel'],
    availabilitySlots: [],
    sensitiveDataConsent: true,
    housingSituation: 'seul',
    hasDisability: true,
    disabilityDescription: 'Mobilité réduite',
    allergies: 'Arachides',
    sensitiveDataConsentAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
    ...overrides,
  };
}

function buildApplication(overrides: Partial<ModerationApplication> = {}): ModerationApplication {
  return {
    id: 'application-1',
    offer: buildOffer(),
    student: buildStudent(),
    status: 'pending_moderation',
    message: 'Je suis très motivée.',
    rejectionReason: null,
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
    ...overrides,
  };
}

describe('ModerationApplicationsDetail', () => {
  let fixture: ComponentFixture<ModerationApplicationsDetail>;
  let apiMock: {
    list: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    approve: ReturnType<typeof vi.fn>;
    reject: ReturnType<typeof vi.fn>;
  };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };

  async function setup(
    options: {
      applicationId?: string;
      application?: ModerationApplication;
      detailResponse?: Observable<ModerationApplication>;
    } = {},
  ): Promise<void> {
    const applicationId = options.applicationId ?? 'application-1';

    apiMock = {
      list: vi.fn(),
      get: vi
        .fn()
        .mockReturnValue(
          options.detailResponse ??
            of(options.application ?? buildApplication({ id: applicationId })),
        ),
      approve: vi.fn(),
      reject: vi.fn(),
    };
    routerMock = { navigate: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [ModerationApplicationsDetail],
      providers: [
        provideNoopAnimations(),
        provideTanStackQuery(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
        { provide: ModerationApplicationsApiService, useValue: apiMock },
        { provide: Router, useValue: routerMock },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ applicationId })) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ModerationApplicationsDetail);
    fixture.detectChanges();
  }

  function query<T extends Element = Element>(selector: string): T {
    return fixture.nativeElement.querySelector(selector) as T;
  }

  /**
   * Attend que `detailQuery` ait résolu (avec succès) et que le contenu dépendant des données
   * (offre, étudiant, actions) soit rendu — la requête résout de façon asynchrone (TanStack
   * Query), un simple `detectChanges()` juste après `setup()` ne suffit pas à la garantir déjà
   * résolue (même piège documenté dans `detail.spec.ts`).
   */
  async function waitForApplicationLoaded(): Promise<void> {
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(query('#approve-button')).not.toBeNull();
    });
  }

  it('creates the component', async () => {
    await setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('requests the detail with the applicationId read from the route', async () => {
    await setup({ applicationId: 'application-77' });

    await vi.waitFor(() => {
      expect(apiMock.get).toHaveBeenCalledWith('application-77');
    });
  });

  it('shows a loading spinner while the detail query is pending', async () => {
    await setup({ detailResponse: new Subject<ModerationApplication>() });

    expect(fixture.nativeElement.textContent).toContain('Chargement de la candidature');
  });

  it("shows the backend's translated message when the detail query fails (e.g. 404 not found)", async () => {
    const errorResponse = new HttpErrorResponse({
      status: 404,
      error: {
        statusCode: 404,
        error: 'APPLICATION_NOT_FOUND',
        message: 'Cette candidature est introuvable.',
        timestamp: '2026-07-16T00:00:00.000Z',
        path: '/moderation/applications/application-404',
      },
    });

    await setup({ detailResponse: throwError(() => errorResponse) });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Cette candidature est introuvable.');
    });
  });

  it('renders the offer, the full student profile (including sensitive fields) and the motivation message', async () => {
    await setup({
      application: buildApplication({
        offer: buildOffer({ title: 'Caissier', structureName: 'Supermarché XYZ' }),
        student: buildStudent({
          firstName: 'Koffi',
          lastName: 'Mensah',
          university: 'Université de Kara',
          allergies: 'Arachides',
          housingSituation: 'avec_parents_tuteurs',
        }),
        message: 'Disponible tous les week-ends.',
      }),
    });
    await waitForApplicationLoaded();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Caissier');
    expect(text).toContain('Supermarché XYZ');
    expect(text).toContain('Koffi Mensah');
    expect(text).toContain('Université de Kara');
    expect(text).toContain('Disponible tous les week-ends.');
    expect(text).toContain('Arachides');
    expect(text).toContain('Vit avec parents ou tuteurs');
  });

  it('shows a neutral message when the student has not consented to sensitive data collection', async () => {
    await setup({
      application: buildApplication({
        student: buildStudent({
          sensitiveDataConsent: false,
          housingSituation: null,
          allergies: null,
        }),
      }),
    });
    await waitForApplicationLoaded();

    expect(fixture.nativeElement.textContent).toContain(
      "L'étudiant n'a pas consenti à la collecte de ces informations sensibles.",
    );
  });

  it('approves the application with the current applicationId and navigates to the queue on success', async () => {
    await setup({
      applicationId: 'application-5',
      application: buildApplication({ id: 'application-5' }),
    });
    await waitForApplicationLoaded();
    apiMock.approve.mockReturnValue(
      of(buildApplication({ id: 'application-5', status: 'forwarded' })),
    );

    query<HTMLButtonElement>('#approve-button').click();

    await vi.waitFor(() => {
      expect(apiMock.approve).toHaveBeenCalledWith('application-5');
      expect(routerMock.navigate).toHaveBeenCalledWith(['/moderation', 'candidatures']);
    });
  });

  it('disables approve and reject actions once the application has already been forwarded', async () => {
    await setup({
      application: buildApplication({ status: 'forwarded' }),
    });
    await waitForApplicationLoaded();

    expect(query<HTMLButtonElement>('#approve-button').disabled).toBe(true);
    expect(query<HTMLButtonElement>('#show-reject-button').disabled).toBe(true);
  });

  it('blocks the rejection and shows a validation message when the reason is shorter than 3 characters, without calling the mutation', async () => {
    await setup({ application: buildApplication({ id: 'application-5' }) });
    await waitForApplicationLoaded();

    query<HTMLButtonElement>('#show-reject-button').click();
    fixture.detectChanges();

    const textarea = query<HTMLTextAreaElement>('textarea');
    textarea.value = 'ab';
    textarea.dispatchEvent(new Event('input'));

    query<HTMLFormElement>('form').dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    // `mutate()` (TanStack Query) dispatche `mutationFn` de façon asynchrone : sans ce flush,
    // l'assertion négative ci-dessous serait vraie AVANT même que le garde-fou ait eu la chance
    // d'être contourné, rendant le test tautologique (même piège documenté dans `detail.spec.ts`).
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    expect(apiMock.reject).not.toHaveBeenCalled();
    expect(query('form')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Le motif doit contenir au moins 3 caractères.',
    );
  });

  it('rejects the application with {applicationId, reason} and navigates to the queue on success when the reason is valid', async () => {
    await setup({
      applicationId: 'application-5',
      application: buildApplication({ id: 'application-5' }),
    });
    await waitForApplicationLoaded();
    apiMock.reject.mockReturnValue(
      of(
        buildApplication({
          id: 'application-5',
          status: 'rejected_moderation',
          rejectionReason: 'Profil ne correspond pas',
        }),
      ),
    );

    query<HTMLButtonElement>('#show-reject-button').click();
    fixture.detectChanges();

    const textarea = query<HTMLTextAreaElement>('textarea');
    textarea.value = 'Profil ne correspond pas';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    query<HTMLButtonElement>('#confirm-reject-button').click();

    await vi.waitFor(() => {
      expect(apiMock.reject).toHaveBeenCalledWith('application-5', 'Profil ne correspond pas');
      expect(routerMock.navigate).toHaveBeenCalledWith(['/moderation', 'candidatures']);
    });
  });

  it('cancels the reject form without calling the mutation', async () => {
    await setup({ application: buildApplication({ id: 'application-5' }) });
    await waitForApplicationLoaded();

    query<HTMLButtonElement>('#show-reject-button').click();
    fixture.detectChanges();
    expect(query('form')).not.toBeNull();

    query<HTMLButtonElement>('#cancel-reject-button').click();
    fixture.detectChanges();

    expect(query('form')).toBeNull();
    expect(apiMock.reject).not.toHaveBeenCalled();
  });

  it("shows the backend's translated message when the approve mutation fails with a 409 (invalid state)", async () => {
    await setup({ application: buildApplication({ id: 'application-5' }) });
    await waitForApplicationLoaded();
    const errorResponse = new HttpErrorResponse({
      status: 409,
      error: {
        statusCode: 409,
        error: 'APPLICATION_INVALID_STATE',
        message: 'Cette candidature a déjà été traitée.',
        timestamp: '2026-07-16T00:00:00.000Z',
        path: '/moderation/applications/application-5/approve',
      },
    });
    apiMock.approve.mockReturnValue(throwError(() => errorResponse));

    query<HTMLButtonElement>('#approve-button').click();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        'Cette candidature a déjà été traitée.',
      );
    });
  });
});
