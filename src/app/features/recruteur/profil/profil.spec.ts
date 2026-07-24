import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { Observable, of, throwError } from 'rxjs';

import { RecruiterProfileApiService } from '../data/recruiter-profile-api.service';
import { RecruiterProfile, RecruiterProfileUpsertRequest } from '../data/recruiter-profile.types';
import { RecruteurProfil } from './profil';

function buildProfile(overrides: Partial<RecruiterProfile> = {}): RecruiterProfile {
  return {
    userId: 'user-1',
    structureName: 'Café Bon Accueil',
    structureType: 'restaurant',
    contactFirstName: 'Ama',
    contactLastName: 'Koffi',
    phoneNumber: '+228 90 00 00 00',
    location: 'Lomé, Agoè',
    description: 'Restaurant familial cherchant des étudiants pour le service.',
    updatedAt: '2026-07-16T00:00:00.000Z',
    ...overrides,
  };
}

function notFoundError(): HttpErrorResponse {
  return new HttpErrorResponse({
    status: 404,
    error: {
      statusCode: 404,
      error: 'RECRUITER_PROFILE_NOT_FOUND',
      message: "Ce profil n'existe pas encore.",
      timestamp: '2026-07-16T00:00:00.000Z',
      path: '/recruiters/me/profile',
    },
  });
}

describe('RecruteurProfil', () => {
  let fixture: ComponentFixture<RecruteurProfil>;
  let loader: HarnessLoader;
  let recruiterProfileApiMock: {
    getProfile: ReturnType<typeof vi.fn>;
    upsertProfile: ReturnType<typeof vi.fn>;
  };

  async function setup(
    options: { getProfileResponse?: Observable<RecruiterProfile> } = {},
  ): Promise<void> {
    recruiterProfileApiMock = {
      getProfile: vi
        .fn()
        .mockReturnValue(options.getProfileResponse ?? throwError(() => notFoundError())),
      upsertProfile: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [RecruteurProfil],
      providers: [
        provideNoopAnimations(),
        provideTanStackQuery(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
        { provide: RecruiterProfileApiService, useValue: recruiterProfileApiMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RecruteurProfil);
    loader = TestbedHarnessEnvironment.loader(fixture);
    fixture.detectChanges();
  }

  function query<T extends Element = Element>(selector: string): T {
    return fixture.nativeElement.querySelector(selector) as T;
  }

  /**
   * Attend que `profileQuery` ait résolu (succès OU 404 nominal) et que le formulaire soit
   * rendu — la requête resout de façon asynchrone (TanStack Query), un simple
   * `detectChanges()` juste après `setup()` ne suffit pas à le garantir déjà résolu (même
   * piège que `student-profile-form.spec.ts` — voir `waitForFormLoaded`).
   */
  async function waitForFormLoaded(): Promise<void> {
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(query('form')).not.toBeNull();
    });
  }

  function setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  async function selectStructureType(text: string): Promise<void> {
    const select = await loader.getHarness(
      MatSelectHarness.with({ selector: '#structure-type-select' }),
    );
    await select.open();
    await select.clickOptions({ text });
    fixture.detectChanges();
  }

  function fillRequiredFields(): void {
    setInputValue(query('#structure-name-input'), 'Café Bon Accueil');
    setInputValue(query('#contact-first-name-input'), 'Ama');
    setInputValue(query('#contact-last-name-input'), 'Koffi');
    setInputValue(query('#phone-number-input'), '+228 90 00 00 00');
    setInputValue(query('#location-input'), 'Lomé, Agoè');
    fixture.detectChanges();
  }

  it('creates the component', async () => {
    await setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows a loading spinner while the profile query is pending', async () => {
    await setup({ getProfileResponse: new Observable() });
    expect(fixture.nativeElement.textContent).toContain('Chargement de ton profil');
  });

  it('shows an empty form (no error) when the profile has not been created yet (404 RECRUITER_PROFILE_NOT_FOUND)', async () => {
    await setup();
    await waitForFormLoaded();

    expect(query('[role="alert"]')).toBeNull();
    expect((query('#structure-name-input') as HTMLInputElement).value).toBe('');
  });

  it("shows the backend's translated message for a non-404 profile load error", async () => {
    const errorResponse = new HttpErrorResponse({
      status: 500,
      error: {
        statusCode: 500,
        error: 'INTERNAL_ERROR',
        message: 'Une erreur est survenue côté serveur.',
        timestamp: '2026-07-16T00:00:00.000Z',
        path: '/recruiters/me/profile',
      },
    });
    await setup({ getProfileResponse: throwError(() => errorResponse) });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(query('[role="alert"]')?.textContent).toContain('Une erreur est survenue côté serveur.');
    });
  });

  it('pre-fills the form from an existing profile', async () => {
    await setup({ getProfileResponse: of(buildProfile()) });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect((query('#structure-name-input') as HTMLInputElement).value).toBe('Café Bon Accueil');
      expect((query('#contact-first-name-input') as HTMLInputElement).value).toBe('Ama');
      expect((query('#phone-number-input') as HTMLInputElement).value).toBe('+228 90 00 00 00');
      expect((query('#location-input') as HTMLInputElement).value).toBe('Lomé, Agoè');
    });
  });

  it('blocks submission and shows validation errors when required fields are empty', async () => {
    await setup();
    await waitForFormLoaded();

    query<HTMLButtonElement>('#submit-button').click();
    fixture.detectChanges();

    expect(recruiterProfileApiMock.upsertProfile).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('est requis');
  });

  it('submits a valid RecruiterProfileUpsertRequest payload and shows a success message', async () => {
    await setup();
    await waitForFormLoaded();
    const savedProfile = buildProfile();
    recruiterProfileApiMock.upsertProfile.mockReturnValue(of(savedProfile));

    fillRequiredFields();
    await selectStructureType('Restaurant');
    setInputValue(query('#description-textarea'), 'Restaurant familial cherchant des étudiants pour le service.');
    fixture.detectChanges();

    query<HTMLButtonElement>('#submit-button').click();

    const expectedPayload: RecruiterProfileUpsertRequest = {
      structureName: 'Café Bon Accueil',
      structureType: 'restaurant',
      contactFirstName: 'Ama',
      contactLastName: 'Koffi',
      phoneNumber: '+228 90 00 00 00',
      location: 'Lomé, Agoè',
      description: 'Restaurant familial cherchant des étudiants pour le service.',
    };

    await vi.waitFor(() => {
      expect(recruiterProfileApiMock.upsertProfile).toHaveBeenCalledWith(expectedPayload);
    });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(query('[role="status"]')?.textContent).toContain('a été enregistré');
    });
  });
});
