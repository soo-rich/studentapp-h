import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatCheckboxHarness } from '@angular/material/checkbox/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { Observable, of, throwError } from 'rxjs';

import { ProfileApiService } from '../../data/profile-api.service';
import { StudentProfile, StudentProfileUpsertRequest } from '../../data/profile.types';
import { StudentProfileForm } from './student-profile-form';

function buildProfile(overrides: Partial<StudentProfile> = {}): StudentProfile {
  return {
    userId: 'user-1',
    firstName: 'Ama',
    lastName: 'Koffi',
    phoneNumber: '+228 90 00 00 00',
    university: 'Université de Lomé',
    studentCardNumber: 'UL-2026-001',
    fieldOfStudy: 'Informatique',
    studyLevel: 'Licence 3',
    skills: ['JavaScript', 'Gestion de projet'],
    experiences: 'Stage de 2 mois en développement web.',
    languages: ['Français', 'Ewe'],
    residenceLocation: 'Lomé, Agoè',
    opportunityTypes: ['temps_partiel', 'stage'],
    availabilitySlots: [{ dayOfWeek: 'lundi', startTime: '08:00', endTime: '12:00' }],
    housingSituation: 'avec_parents_tuteurs',
    hasDisability: false,
    disabilityDescription: null,
    allergies: 'Arachides',
    sensitiveDataConsent: true,
    sensitiveDataConsentAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
    ...overrides,
  };
}

function notFoundError(): HttpErrorResponse {
  return new HttpErrorResponse({
    status: 404,
    error: {
      statusCode: 404,
      error: 'PROFILE_NOT_FOUND',
      message: "Ce profil n'existe pas encore.",
      timestamp: '2026-07-16T00:00:00.000Z',
      path: '/students/me/profile',
    },
  });
}

describe('StudentProfileForm', () => {
  let fixture: ComponentFixture<StudentProfileForm>;
  let loader: HarnessLoader;
  let profileApiMock: {
    getProfile: ReturnType<typeof vi.fn>;
    upsertProfile: ReturnType<typeof vi.fn>;
  };

  async function setup(options: {
    getProfileResponse?: Observable<StudentProfile>;
  } = {}): Promise<void> {
    profileApiMock = {
      getProfile: vi.fn().mockReturnValue(options.getProfileResponse ?? throwError(() => notFoundError())),
      upsertProfile: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [StudentProfileForm],
      providers: [
        provideNoopAnimations(),
        provideTanStackQuery(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
        { provide: ProfileApiService, useValue: profileApiMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StudentProfileForm);
    loader = TestbedHarnessEnvironment.loader(fixture);
    fixture.detectChanges();
  }

  function query<T extends Element = Element>(selector: string): T {
    return fixture.nativeElement.querySelector(selector) as T;
  }

  function queryAll<T extends Element = Element>(selector: string): T[] {
    return Array.from(fixture.nativeElement.querySelectorAll(selector)) as T[];
  }

  function setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function clickButtonWithText(text: string): void {
    const button = queryAll<HTMLButtonElement>('button').find(
      (candidate) => candidate.textContent?.includes(text) === true,
    );
    if (button === undefined) {
      throw new Error(`No button found with text "${text}"`);
    }
    button.click();
    fixture.detectChanges();
  }

  async function getCheckboxHarness(id: string): Promise<MatCheckboxHarness> {
    return loader.getHarness(MatCheckboxHarness.with({ selector: `#${id}` }));
  }

  async function checkCheckbox(id: string): Promise<void> {
    const checkbox = await getCheckboxHarness(id);
    await checkbox.check();
    fixture.detectChanges();
  }

  async function uncheckCheckbox(id: string): Promise<void> {
    const checkbox = await getCheckboxHarness(id);
    await checkbox.uncheck();
    fixture.detectChanges();
  }

  async function isCheckboxChecked(id: string): Promise<boolean> {
    const checkbox = await getCheckboxHarness(id);
    return checkbox.isChecked();
  }

  async function getSelectHarness(id: string): Promise<MatSelectHarness> {
    return loader.getHarness(MatSelectHarness.with({ selector: `#${id}` }));
  }

  async function selectOption(id: string, text: string): Promise<void> {
    const select = await getSelectHarness(id);
    await select.open();
    await select.clickOptions({ text });
    fixture.detectChanges();
  }

  async function getSelectValueText(id: string): Promise<string> {
    const select = await getSelectHarness(id);
    return select.getValueText();
  }

  /** Attend que le formulaire (chargement du profil résolu) soit rendu. */
  async function waitForFormLoaded(): Promise<void> {
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(query('#submit-button')).not.toBeNull();
    });
  }

  /** Remplit tous les champs requis SAUF `opportunityTypes` (laissé vide volontairement par certains tests). */
  function fillRequiredScalarFields(): void {
    setInputValue(query<HTMLInputElement>('#first-name-input'), 'Ama');
    setInputValue(query<HTMLInputElement>('#last-name-input'), 'Koffi');
    setInputValue(query<HTMLInputElement>('#university-input'), 'Université de Lomé');
    setInputValue(query<HTMLInputElement>('#student-card-number-input'), 'UL-2026-001');
    setInputValue(query<HTMLInputElement>('#field-of-study-input'), 'Informatique');
    setInputValue(query<HTMLInputElement>('#study-level-input'), 'Licence 3');
    setInputValue(query<HTMLInputElement>('#residence-location-input'), 'Lomé, Agoè');
    fixture.detectChanges();
  }

  async function fillRequiredFields(): Promise<void> {
    fillRequiredScalarFields();
    await checkCheckbox('opportunity-type-checkbox-0');
  }

  /** Laisse s'écouler un tick macrotask, pour donner sa chance à un appel non désiré de se produire
   * avant d'asserter une absence d'appel (`mutate()` dispatche `mutationFn` de façon asynchrone) —
   * même pattern que `moderation/detail.spec.ts`. */
  async function flushMacrotask(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  it('creates the component', async () => {
    await setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders a blank form (no error) when the profile query fails with 404 PROFILE_NOT_FOUND (nominal case)', async () => {
    await setup({ getProfileResponse: throwError(() => notFoundError()) });
    await waitForFormLoaded();

    expect(query('[role="alert"]')).toBeNull();
    expect(query<HTMLInputElement>('#first-name-input').value).toBe('');
  });

  it('shows an error message when the profile query fails with a non-404 error', async () => {
    const serverError = new HttpErrorResponse({
      status: 500,
      error: {
        statusCode: 500,
        error: 'INTERNAL_ERROR',
        message: 'Le chargement du profil a échoué.',
        timestamp: '2026-07-16T00:00:00.000Z',
        path: '/students/me/profile',
      },
    });
    await setup({ getProfileResponse: throwError(() => serverError) });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(query('[role="alert"]')).not.toBeNull();
    });
    expect(fixture.nativeElement.textContent).toContain('Le chargement du profil a échoué.');
    expect(query('#submit-button')).toBeNull();
  });

  it('prefills the form fields from an existing profile', async () => {
    await setup({ getProfileResponse: of(buildProfile()) });
    await waitForFormLoaded();

    expect(query<HTMLInputElement>('#first-name-input').value).toBe('Ama');
    expect(query<HTMLInputElement>('#last-name-input').value).toBe('Koffi');
    expect(query<HTMLInputElement>('#university-input').value).toBe('Université de Lomé');
    expect(query<HTMLInputElement>('#student-card-number-input').value).toBe('UL-2026-001');
    expect(query<HTMLInputElement>('#field-of-study-input').value).toBe('Informatique');
    expect(query<HTMLInputElement>('#study-level-input').value).toBe('Licence 3');
    expect(query<HTMLInputElement>('#residence-location-input').value).toBe('Lomé, Agoè');

    const skillInputs = queryAll<HTMLInputElement>('[id^="skill-input-"]');
    expect(skillInputs.map((input) => input.value)).toEqual(['JavaScript', 'Gestion de projet']);

    const languageInputs = queryAll<HTMLInputElement>('[id^="language-input-"]');
    expect(languageInputs.map((input) => input.value)).toEqual(['Français', 'Ewe']);

    // temps_partiel (index 0) et stage (index 3) doivent être cochés, les 2 autres non.
    expect(await isCheckboxChecked('opportunity-type-checkbox-0')).toBe(true);
    expect(await isCheckboxChecked('opportunity-type-checkbox-1')).toBe(false);
    expect(await isCheckboxChecked('opportunity-type-checkbox-2')).toBe(false);
    expect(await isCheckboxChecked('opportunity-type-checkbox-3')).toBe(true);

    expect(await getSelectValueText('availability-day-select-0')).toBe('Lundi');
    expect(query<HTMLInputElement>('#availability-start-input-0').value).toBe('08:00');
    expect(query<HTMLInputElement>('#availability-end-input-0').value).toBe('12:00');

    expect(await isCheckboxChecked('sensitive-consent-checkbox')).toBe(true);
    expect(await getSelectValueText('housing-situation-select')).toBe('Vit avec parents ou tuteurs');
    expect(query<HTMLTextAreaElement>('#allergies-textarea').value).toBe('Arachides');
  });

  it('hides the sensitive data section until consent is given, then shows it', async () => {
    await setup({ getProfileResponse: throwError(() => notFoundError()) });
    await waitForFormLoaded();

    expect(query('#housing-situation-select')).toBeNull();
    expect(query('#allergies-textarea')).toBeNull();

    await checkCheckbox('sensitive-consent-checkbox');

    expect(query('#housing-situation-select')).not.toBeNull();
    expect(query('#allergies-textarea')).not.toBeNull();
  });

  it(
    'clears sensitive field values and omits them from the submitted payload when consent is ' +
      'revoked after being filled in',
    async () => {
      await setup({ getProfileResponse: throwError(() => notFoundError()) });
      await waitForFormLoaded();
      await fillRequiredFields();

      await checkCheckbox('sensitive-consent-checkbox');
      await selectOption('housing-situation-select', 'Vit seul(e)');
      await checkCheckbox('has-disability-checkbox');
      setInputValue(
        query<HTMLTextAreaElement>('#disability-description-textarea'),
        'Ne voit pas bien de loin',
      );
      setInputValue(query<HTMLTextAreaElement>('#allergies-textarea'), 'Arachides');
      fixture.detectChanges();

      // Revoke consent: the form-side values must be cleared immediately, and the section hidden.
      await uncheckCheckbox('sensitive-consent-checkbox');
      expect(query('#housing-situation-select')).toBeNull();

      // Re-show the section (re-consent) to prove, via the rendered DOM (black-box, no access to
      // component internals), that the underlying form values were actually reset — not merely
      // hidden — while consent was off.
      await checkCheckbox('sensitive-consent-checkbox');
      expect(await getSelectValueText('housing-situation-select')).toBe('Non précisé');
      expect(await isCheckboxChecked('has-disability-checkbox')).toBe(false);
      expect(query('#disability-description-textarea')).toBeNull();
      expect(query<HTMLTextAreaElement>('#allergies-textarea').value).toBe('');

      // Revoke consent again before submitting, so the submitted payload is built with
      // `sensitiveDataConsent: false`.
      await uncheckCheckbox('sensitive-consent-checkbox');

      profileApiMock.upsertProfile.mockReturnValue(of(buildProfile({ sensitiveDataConsent: false })));
      query<HTMLButtonElement>('#submit-button').click();

      await vi.waitFor(() => {
        expect(profileApiMock.upsertProfile).toHaveBeenCalled();
      });

      const payload = profileApiMock.upsertProfile.mock.calls[0][0] as StudentProfileUpsertRequest;
      expect(payload.sensitiveDataConsent).toBe(false);
      expect(payload.housingSituation).toBeNull();
      expect(payload.hasDisability).toBeNull();
      expect(payload.disabilityDescription).toBeNull();
      expect(payload.allergies).toBeNull();
    },
  );

  it('shows a validation message and does not submit when startTime is not before endTime', async () => {
    await setup({ getProfileResponse: throwError(() => notFoundError()) });
    await waitForFormLoaded();
    await fillRequiredFields();

    clickButtonWithText('Ajouter un créneau');

    setInputValue(query<HTMLInputElement>('#availability-start-input-0'), '10:00');
    setInputValue(query<HTMLInputElement>('#availability-end-input-0'), '09:00');
    fixture.detectChanges();

    query<HTMLButtonElement>('#submit-button').click();
    fixture.detectChanges();

    await flushMacrotask();

    expect(profileApiMock.upsertProfile).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      "L'heure de début doit être avant l'heure de fin.",
    );
  });

  it('shows a validation message and does not submit when no opportunity type is selected', async () => {
    await setup({ getProfileResponse: throwError(() => notFoundError()) });
    await waitForFormLoaded();
    fillRequiredScalarFields(); // deliberately: no opportunity type checked

    query<HTMLButtonElement>('#submit-button').click();
    fixture.detectChanges();

    await flushMacrotask();

    expect(profileApiMock.upsertProfile).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      "Sélectionne au moins un type d'opportunité.",
    );
  });

  it(
    'adds and removes skills/languages interactively and reflects the final list in the ' +
      'submitted payload',
    async () => {
      await setup({ getProfileResponse: throwError(() => notFoundError()) });
      await waitForFormLoaded();
      await fillRequiredFields();

      clickButtonWithText('Ajouter une compétence');
      setInputValue(query<HTMLInputElement>('#skill-input-0'), 'JavaScript');
      clickButtonWithText('Ajouter une compétence');
      setInputValue(query<HTMLInputElement>('#skill-input-1'), 'Gestion de projet');
      fixture.detectChanges();

      // Remove the first skill entered (JavaScript) — only "Gestion de projet" should remain.
      query<HTMLButtonElement>('button[aria-label="Supprimer la compétence 1"]').click();
      fixture.detectChanges();

      clickButtonWithText('Ajouter une langue');
      setInputValue(query<HTMLInputElement>('#language-input-0'), 'Français');
      fixture.detectChanges();

      profileApiMock.upsertProfile.mockReturnValue(of(buildProfile()));
      query<HTMLButtonElement>('#submit-button').click();

      await vi.waitFor(() => {
        expect(profileApiMock.upsertProfile).toHaveBeenCalled();
      });

      const payload = profileApiMock.upsertProfile.mock.calls[0][0] as StudentProfileUpsertRequest;
      expect(payload.skills).toEqual(['Gestion de projet']);
      expect(payload.languages).toEqual(['Français']);
    },
  );

  it('submits the mutation with the exact expected payload when the form is valid', async () => {
    await setup({ getProfileResponse: throwError(() => notFoundError()) });
    await waitForFormLoaded();
    await fillRequiredFields();

    profileApiMock.upsertProfile.mockReturnValue(of(buildProfile()));
    query<HTMLButtonElement>('#submit-button').click();

    await vi.waitFor(() => {
      expect(profileApiMock.upsertProfile).toHaveBeenCalled();
    });

    expect(profileApiMock.upsertProfile).toHaveBeenCalledWith({
      firstName: 'Ama',
      lastName: 'Koffi',
      phoneNumber: null,
      university: 'Université de Lomé',
      studentCardNumber: 'UL-2026-001',
      fieldOfStudy: 'Informatique',
      studyLevel: 'Licence 3',
      skills: [],
      experiences: null,
      languages: [],
      residenceLocation: 'Lomé, Agoè',
      opportunityTypes: ['temps_partiel'],
      availabilitySlots: [],
      sensitiveDataConsent: false,
      housingSituation: null,
      hasDisability: null,
      disabilityDescription: null,
      allergies: null,
    });
  });

  it('shows a clear message when the upsert mutation fails with 422 PROFILE_SENSITIVE_CONSENT_REQUIRED', async () => {
    await setup({ getProfileResponse: throwError(() => notFoundError()) });
    await waitForFormLoaded();
    await fillRequiredFields();

    const consentError = new HttpErrorResponse({
      status: 422,
      error: {
        statusCode: 422,
        error: 'PROFILE_SENSITIVE_CONSENT_REQUIRED',
        message: 'Le consentement est requis.',
        timestamp: '2026-07-16T00:00:00.000Z',
        path: '/students/me/profile',
      },
    });
    profileApiMock.upsertProfile.mockReturnValue(throwError(() => consentError));

    query<HTMLButtonElement>('#submit-button').click();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(query('[role="alert"]')).not.toBeNull();
    });
    expect(fixture.nativeElement.textContent).toContain(
      'Coche la case de consentement pour pouvoir enregistrer les informations sensibles.',
    );
  });
});
