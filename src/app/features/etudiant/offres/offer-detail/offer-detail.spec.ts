import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { Observable, of, Subject, throwError } from 'rxjs';

import { ApplicationsApiService } from '../../data/applications-api.service';
import { StudentApplication } from '../../data/applications.types';
import { PublicOffersApiService } from '../../data/public-offers-api.service';
import { PublicOffer } from '../../data/public-offers.types';
import { OfferDetail } from './offer-detail';

function buildOffer(overrides: Partial<PublicOffer> = {}): PublicOffer {
  return {
    id: 'offer-1',
    title: 'Serveur en salle',
    description: 'Service en salle le week-end.',
    opportunityType: 'job_vacances',
    requiredSkills: ['Service client'],
    location: 'Lomé, Agoè',
    durationLabel: '3 mois',
    compensationLabel: '50 000 FCFA / mois',
    availabilitySlots: [{ dayOfWeek: 'samedi', startTime: '08:00', endTime: '18:00' }],
    recruiter: {
      structureName: 'Le Bon Coin Resto',
      structureType: 'restaurant',
      location: 'Lomé, Agoè',
      description: 'Restaurant familial au coeur de Lomé.',
    },
    publishedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

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
    message: null,
    rejectionReason: null,
    createdAt: '2026-07-16T00:00:00.000Z',
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
      path: '/offers/offer-1/applications',
    },
  });
}

describe('OfferDetail', () => {
  let fixture: ComponentFixture<OfferDetail>;
  let publicOffersApiMock: { getOffer: ReturnType<typeof vi.fn> };
  let applicationsApiMock: { apply: ReturnType<typeof vi.fn> };

  async function setup(
    options: {
      offerId?: string;
      offer?: PublicOffer;
      detailResponse?: Observable<PublicOffer>;
    } = {},
  ): Promise<void> {
    const offerId = options.offerId ?? 'offer-1';

    publicOffersApiMock = {
      getOffer: vi
        .fn()
        .mockReturnValue(options.detailResponse ?? of(options.offer ?? buildOffer({ id: offerId }))),
    };
    applicationsApiMock = { apply: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [OfferDetail],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        provideTanStackQuery(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
        { provide: PublicOffersApiService, useValue: publicOffersApiMock },
        { provide: ApplicationsApiService, useValue: applicationsApiMock },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ offerId })) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OfferDetail);
    fixture.detectChanges();
  }

  function query<T extends Element = Element>(selector: string): T {
    return fixture.nativeElement.querySelector(selector) as T;
  }

  async function waitForOfferLoaded(): Promise<void> {
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(query('#show-apply-form-button')).not.toBeNull();
    });
  }

  it('creates the component', async () => {
    await setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('requests the offer with the offerId read from the route', async () => {
    await setup({ offerId: 'offer-77' });

    await vi.waitFor(() => {
      expect(publicOffersApiMock.getOffer).toHaveBeenCalledWith('offer-77');
    });
  });

  it('shows a loading spinner while the offer query is pending', async () => {
    await setup({ detailResponse: new Subject<PublicOffer>() });

    expect(fixture.nativeElement.textContent).toContain("Chargement de l'offre");
  });

  it("shows the backend's translated message when the offer query fails (e.g. 404 not found)", async () => {
    await setup({
      detailResponse: throwError(() =>
        buildErrorResponse(404, 'OFFER_NOT_FOUND', 'Cette offre est introuvable.'),
      ),
    });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Cette offre est introuvable.');
    });
  });

  it('renders offer, recruiter, required skills and availability slots', async () => {
    await setup({
      offer: buildOffer({
        title: 'Serveur en salle',
        description: 'Service en salle le week-end.',
        location: 'Lomé, Agoè',
        durationLabel: '3 mois',
        compensationLabel: '50 000 FCFA / mois',
        requiredSkills: ['Service client'],
        availabilitySlots: [{ dayOfWeek: 'samedi', startTime: '08:00', endTime: '18:00' }],
        recruiter: {
          structureName: 'Le Bon Coin Resto',
          structureType: 'restaurant',
          location: 'Lomé, Agoè',
          description: 'Restaurant familial au coeur de Lomé.',
        },
      }),
    });
    await waitForOfferLoaded();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Serveur en salle');
    expect(text).toContain('Service en salle le week-end.');
    expect(text).toContain('3 mois');
    expect(text).toContain('50 000 FCFA / mois');
    expect(text).toContain('Service client');
    expect(text).toContain('Samedi');
    expect(text).toContain('08:00 – 18:00');
    expect(text).toContain('Le Bon Coin Resto');
    expect(text).toContain('Restaurant');
    expect(text).toContain('Restaurant familial au coeur de Lomé.');
  });

  it('shows the apply form with an optional message textarea when "Postuler" is clicked', async () => {
    await setup();
    await waitForOfferLoaded();

    query<HTMLButtonElement>('#show-apply-form-button').click();
    fixture.detectChanges();

    expect(query('#apply-message-textarea')).not.toBeNull();
  });

  it('submits the application with the trimmed message and shows a success message with a link to my applications', async () => {
    await setup({ offerId: 'offer-1' });
    await waitForOfferLoaded();
    applicationsApiMock.apply.mockReturnValue(of(buildApplication()));

    query<HTMLButtonElement>('#show-apply-form-button').click();
    fixture.detectChanges();

    const textarea = query<HTMLTextAreaElement>('#apply-message-textarea');
    textarea.value = '  Disponible tous les week-ends.  ';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    query<HTMLButtonElement>('#submit-apply-button').click();

    await vi.waitFor(() => {
      expect(applicationsApiMock.apply).toHaveBeenCalledWith('offer-1', {
        message: 'Disponible tous les week-ends.',
      });
    });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Ta candidature a bien été envoyée.');
      const link = query<HTMLAnchorElement>('#view-applications-link');
      expect(link.getAttribute('href')).toBe('/etudiant/candidatures');
    });
  });

  it('submits null as the message when the textarea is left empty', async () => {
    await setup();
    await waitForOfferLoaded();
    applicationsApiMock.apply.mockReturnValue(of(buildApplication({ message: null })));

    query<HTMLButtonElement>('#show-apply-form-button').click();
    fixture.detectChanges();
    query<HTMLButtonElement>('#submit-apply-button').click();

    await vi.waitFor(() => {
      expect(applicationsApiMock.apply).toHaveBeenCalledWith('offer-1', { message: null });
    });
  });

  it('shows a dedicated message when the application already exists (409)', async () => {
    await setup();
    await waitForOfferLoaded();
    applicationsApiMock.apply.mockReturnValue(
      throwError(() =>
        buildErrorResponse(
          409,
          'APPLICATION_ALREADY_EXISTS',
          'Une candidature existe déjà pour cette offre.',
        ),
      ),
    );

    query<HTMLButtonElement>('#show-apply-form-button').click();
    fixture.detectChanges();
    query<HTMLButtonElement>('#submit-apply-button').click();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Tu as déjà candidaté à cette offre.');
    });
  });

  it('shows a dedicated message when the offer is no longer open (422 OFFER_NOT_OPEN)', async () => {
    await setup();
    await waitForOfferLoaded();
    applicationsApiMock.apply.mockReturnValue(
      throwError(() => buildErrorResponse(422, 'OFFER_NOT_OPEN', "L'offre n'est plus ouverte.")),
    );

    query<HTMLButtonElement>('#show-apply-form-button').click();
    fixture.detectChanges();
    query<HTMLButtonElement>('#submit-apply-button').click();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        "Cette offre n'est plus ouverte aux candidatures.",
      );
    });
  });

  it('shows a dedicated message with a link to complete the profile when PROFILE_REQUIRED (422)', async () => {
    await setup();
    await waitForOfferLoaded();
    applicationsApiMock.apply.mockReturnValue(
      throwError(() =>
        buildErrorResponse(422, 'PROFILE_REQUIRED', 'Un profil étudiant est requis.'),
      ),
    );

    query<HTMLButtonElement>('#show-apply-form-button').click();
    fixture.detectChanges();
    query<HTMLButtonElement>('#submit-apply-button').click();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        'Complète ton profil étudiant avant de pouvoir postuler.',
      );
      const link = query<HTMLAnchorElement>('#complete-profile-link');
      expect(link.getAttribute('href')).toBe('/etudiant/profil');
    });
  });
});
