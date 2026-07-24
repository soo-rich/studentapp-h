import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { of, throwError } from 'rxjs';

import { OffersApiService } from '../../data/offers-api.service';
import { Offer, OfferCreateRequest } from '../../data/offers.types';
import { NouvelleOffre } from './nouvelle';

function buildOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: 'offer-1',
    title: 'Serveur pour événement',
    description: 'Service en salle pour un événement de deux jours.',
    opportunityType: 'job_vacances',
    requiredSkills: [],
    location: 'Lomé, Agoè',
    durationLabel: '2 jours',
    compensationLabel: '5000 FCFA/jour',
    availabilitySlots: [],
    status: 'draft',
    forwardedCandidatesCount: 0,
    publishedAt: null,
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
    ...overrides,
  };
}

describe('NouvelleOffre', () => {
  let fixture: ComponentFixture<NouvelleOffre>;
  let loader: HarnessLoader;
  let offersApiMock: { createOffer: ReturnType<typeof vi.fn> };
  let navigateSpy: ReturnType<typeof vi.fn>;

  async function setup(): Promise<void> {
    offersApiMock = { createOffer: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [NouvelleOffre],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        provideTanStackQuery(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
        { provide: OffersApiService, useValue: offersApiMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NouvelleOffre);
    loader = TestbedHarnessEnvironment.loader(fixture);
    navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate') as unknown as ReturnType<typeof vi.fn>;
    fixture.detectChanges();
  }

  function query<T extends Element = Element>(selector: string): T {
    return fixture.nativeElement.querySelector(selector) as T;
  }

  function setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  async function selectOpportunityType(text: string): Promise<void> {
    const select = await loader.getHarness(
      MatSelectHarness.with({ selector: '#opportunity-type-select' }),
    );
    await select.open();
    await select.clickOptions({ text });
    fixture.detectChanges();
  }

  function fillValidForm(): void {
    setInputValue(query('#title-input'), 'Serveur pour événement');
    setInputValue(query('#description-textarea'), 'Service en salle pour un événement de deux jours.');
    setInputValue(query('#location-input'), 'Lomé, Agoè');
    setInputValue(query('#duration-label-input'), '2 jours');
    setInputValue(query('#compensation-label-input'), '5000 FCFA/jour');
    fixture.detectChanges();
  }

  it('creates the component', async () => {
    await setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('blocks submission and shows validation errors when required fields are empty', async () => {
    await setup();

    query<HTMLButtonElement>('#submit-button').click();
    fixture.detectChanges();

    expect(offersApiMock.createOffer).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('est requis');
  });

  it('submits a valid OfferCreateRequest payload and navigates to the created offer detail', async () => {
    await setup();
    const created = buildOffer({ id: 'offer-99' });
    offersApiMock.createOffer.mockReturnValue(of(created));

    fillValidForm();
    await selectOpportunityType('Job de vacances');

    query<HTMLButtonElement>('#submit-button').click();

    const expectedPayload: OfferCreateRequest = {
      title: 'Serveur pour événement',
      description: 'Service en salle pour un événement de deux jours.',
      opportunityType: 'job_vacances',
      location: 'Lomé, Agoè',
      durationLabel: '2 jours',
      compensationLabel: '5000 FCFA/jour',
    };

    await vi.waitFor(() => {
      expect(offersApiMock.createOffer).toHaveBeenCalledWith(expectedPayload);
      expect(navigateSpy).toHaveBeenCalledWith(['/recruteur', 'offres', 'offer-99']);
    });
  });

  it('shows a dedicated message and a link to the profile form on 422 RECRUITER_PROFILE_REQUIRED', async () => {
    await setup();
    const errorResponse = new HttpErrorResponse({
      status: 422,
      error: {
        statusCode: 422,
        error: 'RECRUITER_PROFILE_REQUIRED',
        message: 'Un profil recruteur est requis pour créer une offre.',
        timestamp: '2026-07-16T00:00:00.000Z',
        path: '/recruiters/me/offers',
      },
    });
    offersApiMock.createOffer.mockReturnValue(throwError(() => errorResponse));

    fillValidForm();
    await selectOpportunityType('Job de vacances');

    query<HTMLButtonElement>('#submit-button').click();

    await vi.waitFor(() => {
      fixture.detectChanges();
      const alert = query('[role="alert"]');
      expect(alert?.textContent).toContain("Complète d'abord ton profil recruteur");
      expect(alert?.querySelector('a')?.getAttribute('href')).toBe('/recruteur/profil');
    });
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("shows the backend's translated message for a non-RECRUITER_PROFILE_REQUIRED error, without a profile link", async () => {
    await setup();
    const errorResponse = new HttpErrorResponse({
      status: 422,
      error: {
        statusCode: 422,
        error: 'VALIDATION_FAILED',
        message: 'Validation échouée.',
        timestamp: '2026-07-16T00:00:00.000Z',
        path: '/recruiters/me/offers',
      },
    });
    offersApiMock.createOffer.mockReturnValue(throwError(() => errorResponse));

    fillValidForm();
    await selectOpportunityType('Job de vacances');

    query<HTMLButtonElement>('#submit-button').click();

    await vi.waitFor(() => {
      fixture.detectChanges();
      const alert = query('[role="alert"]');
      expect(alert?.textContent).toContain('Validation échouée.');
      expect(alert?.querySelector('a')).toBeNull();
    });
  });
});
