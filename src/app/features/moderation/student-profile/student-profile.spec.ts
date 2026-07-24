import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { Observable, of, Subject, throwError } from 'rxjs';

import { ModerationApiService } from '../data/moderation-api.service';
import { StudentProfile } from '../data/moderation.types';
import { ModerationStudentProfile } from './student-profile';

function buildProfile(overrides: Partial<StudentProfile> = {}): StudentProfile {
  return {
    userId: 'user-1',
    firstName: 'Awa',
    lastName: 'Mensah',
    phoneNumber: '+22890000000',
    university: 'Université de Lomé',
    studentCardNumber: 'ETU-2024-001',
    fieldOfStudy: 'Informatique',
    studyLevel: 'Licence 3',
    skills: ['Gestion de projet', 'Excel'],
    experiences: 'Stage de 3 mois en comptabilité.',
    languages: ['Français', 'Anglais'],
    residenceLocation: 'Lomé, Agoè',
    opportunityTypes: ['temps_partiel', 'stage'],
    availabilitySlots: [
      { dayOfWeek: 'lundi', startTime: '14:00', endTime: '18:00' },
      { dayOfWeek: 'mercredi', startTime: '09:00', endTime: '12:00' },
    ],
    housingSituation: 'avec_parents_tuteurs',
    hasDisability: true,
    disabilityDescription: 'Mobilité réduite.',
    allergies: 'Arachides',
    sensitiveDataConsent: true,
    sensitiveDataConsentAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('ModerationStudentProfile', () => {
  let fixture: ComponentFixture<ModerationStudentProfile>;
  let moderationApiMock: { getStudentProfile: ReturnType<typeof vi.fn> };

  async function setup(
    options: {
      userId?: string | null;
      profile?: StudentProfile;
      profileResponse?: Observable<StudentProfile>;
    } = {},
  ): Promise<void> {
    const userId = options.userId === undefined ? 'user-1' : options.userId;

    moderationApiMock = {
      getStudentProfile: vi
        .fn()
        .mockReturnValue(options.profileResponse ?? of(options.profile ?? buildProfile())),
    };

    const paramMap = userId === null ? {} : { userId };

    await TestBed.configureTestingModule({
      imports: [ModerationStudentProfile],
      providers: [
        provideNoopAnimations(),
        provideTanStackQuery(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
        { provide: ModerationApiService, useValue: moderationApiMock },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap(paramMap)) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ModerationStudentProfile);
    fixture.detectChanges();
  }

  function query<T extends Element = Element>(selector: string): T {
    return fixture.nativeElement.querySelector(selector) as T;
  }

  /**
   * Attend que `profileQuery` ait résolu (avec succès) et que le contenu dépendant des
   * données soit rendu — la requête resout de façon asynchrone (TanStack Query), un simple
   * `detectChanges()` juste après `setup()` ne suffit pas à la garantir déjà résolue. Le
   * badge « Accès restreint » est rendu dans les DEUX branches (consentement donné ou non) :
   * c'est un marqueur fiable de fin de chargement.
   */
  async function waitForProfileLoaded(): Promise<void> {
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(query('#restricted-badge')).not.toBeNull();
    });
  }

  it('creates the component', async () => {
    await setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('requests the profile with the userId read from the route', async () => {
    await setup({ userId: 'user-77' });

    await vi.waitFor(() => {
      expect(moderationApiMock.getStudentProfile).toHaveBeenCalledWith('user-77');
    });
  });

  it('does not request the profile while the route userId is absent (query disabled)', async () => {
    await setup({ userId: null });

    // `mutate`/`queryFn` de TanStack Query ne s'exécute jamais pour une query désactivée, mais
    // on laisse explicitement s'écouler un tick macrotask pour donner sa chance à un appel non
    // désiré de se produire avant d'asserter (sinon l'assertion négative serait vraie même si
    // le garde-fou `enabled` disparaissait, rendant le test tautologique).
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    expect(moderationApiMock.getStudentProfile).not.toHaveBeenCalled();
  });

  it('shows a loading spinner while the profile query is pending', async () => {
    await setup({ profileResponse: new Subject<StudentProfile>() });

    expect(fixture.nativeElement.textContent).toContain('Chargement du profil');
  });

  it('shows a neutral "profil non renseigné" message on 404 PROFILE_NOT_FOUND, not a technical error', async () => {
    const errorResponse = new HttpErrorResponse({
      status: 404,
      error: {
        statusCode: 404,
        error: 'PROFILE_NOT_FOUND',
        message: 'Ce profil est introuvable.',
        timestamp: '2026-07-16T00:00:00.000Z',
        path: '/moderation/students/user-404/profile',
      },
    });

    await setup({ profileResponse: throwError(() => errorResponse) });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Profil non renseigné.');
    });
    // Le message technique brut renvoyé par le backend ne doit jamais être affiché pour ce cas
    // nominal, et aucune alerte d'erreur ne doit être rendue.
    expect(fixture.nativeElement.textContent).not.toContain('Ce profil est introuvable.');
    expect(query('p[role="alert"]')).toBeNull();
  });

  it("shows the backend's translated message when the profile query fails with a non-404 error", async () => {
    const errorResponse = new HttpErrorResponse({
      status: 500,
      error: {
        statusCode: 500,
        error: 'INTERNAL_ERROR',
        message: 'Une erreur est survenue côté serveur.',
        timestamp: '2026-07-16T00:00:00.000Z',
        path: '/moderation/students/user-1/profile',
      },
    });

    await setup({ profileResponse: throwError(() => errorResponse) });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(query('p[role="alert"]')).not.toBeNull();
      expect(fixture.nativeElement.textContent).toContain('Une erreur est survenue côté serveur.');
    });
  });

  it('renders identity, studies, skills, languages, experiences and requested opportunity types', async () => {
    await setup({ profile: buildProfile() });
    await waitForProfileLoaded();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Awa Mensah');
    expect(text).toContain('Université de Lomé');
    expect(text).toContain('ETU-2024-001');
    expect(text).toContain('Informatique');
    expect(text).toContain('Licence 3');
    expect(text).toContain('Gestion de projet');
    expect(text).toContain('Français');
    expect(text).toContain('Stage de 3 mois en comptabilité.');
    expect(text).toContain('Lomé, Agoè');
    expect(text).toContain('Temps partiel');
    expect(text).toContain('Stage');
  });

  it('renders availability slots as a readable day + time range, not raw JSON', async () => {
    await setup({
      profile: buildProfile({
        availabilitySlots: [{ dayOfWeek: 'lundi', startTime: '14:00', endTime: '18:00' }],
      }),
    });
    await waitForProfileLoaded();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Lundi');
    expect(text).toContain('14:00');
    expect(text).toContain('18:00');
    // Preuve que ce n'est pas un dump JSON brut du créneau.
    expect(text).not.toContain('dayOfWeek');
    expect(text).not.toContain('"lundi"');
  });

  it('renders sensitive fields explicitly marked as restricted, never transmitted to recruiters', async () => {
    await setup({
      profile: buildProfile({
        housingSituation: 'avec_parents_tuteurs',
        hasDisability: true,
        disabilityDescription: 'Mobilité réduite.',
        allergies: 'Arachides',
        sensitiveDataConsent: true,
      }),
    });
    await waitForProfileLoaded();

    const badge = query('#restricted-badge');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toContain('Accès restreint');

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('jamais transmises aux recruteurs');
    expect(text).toContain('Vit avec parents ou tuteurs');
    expect(text).toContain('Mobilité réduite.');
    expect(text).toContain('Arachides');
  });

  it('shows a non-consent message instead of ambiguous empty fields when sensitiveDataConsent is false', async () => {
    await setup({
      profile: buildProfile({
        sensitiveDataConsent: false,
        housingSituation: null,
        hasDisability: null,
        disabilityDescription: null,
        allergies: null,
        sensitiveDataConsentAt: null,
      }),
    });
    await waitForProfileLoaded();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain("n'a pas consenti");
    expect(text).not.toContain('Situation de logement');
    expect(text).not.toContain('Vit avec parents ou tuteurs');
    expect(text).not.toContain('Vit seul');
    // Le marquage « restreint » reste affiché même sans consentement : c'est le statut de la
    // section (sensible) qui est signalé, pas la présence de valeurs.
    expect(query('#restricted-badge')).not.toBeNull();
  });
});
