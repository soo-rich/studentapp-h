import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { Observable, of, throwError } from 'rxjs';

import { OffersApiService } from '../../data/offers-api.service';
import { Offer } from '../../data/offers.types';
import { OffreDetail } from './detail';

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
    forwardedCandidatesCount: 2,
    publishedAt: null,
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
    ...overrides,
  };
}

describe('OffreDetail', () => {
  let fixture: ComponentFixture<OffreDetail>;
  let offersApiMock: {
    getOffer: ReturnType<typeof vi.fn>;
    updateOffer: ReturnType<typeof vi.fn>;
    publishOffer: ReturnType<typeof vi.fn>;
    closeOffer: ReturnType<typeof vi.fn>;
  };
  let navigateSpy: ReturnType<typeof vi.fn>;

  async function setup(
    options: {
      offerId?: string;
      offer?: Offer;
      detailResponse?: Observable<Offer>;
    } = {},
  ): Promise<void> {
    const offerId = options.offerId ?? 'offer-1';

    offersApiMock = {
      getOffer: vi
        .fn()
        .mockReturnValue(options.detailResponse ?? of(options.offer ?? buildOffer({ id: offerId }))),
      updateOffer: vi.fn(),
      publishOffer: vi.fn(),
      closeOffer: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [OffreDetail],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        provideTanStackQuery(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
        { provide: OffersApiService, useValue: offersApiMock },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ offerId })) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OffreDetail);
    navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate') as unknown as ReturnType<typeof vi.fn>;
    fixture.detectChanges();
  }

  function query<T extends Element = Element>(selector: string): T {
    return fixture.nativeElement.querySelector(selector) as T;
  }

  async function waitForOfferLoaded(): Promise<void> {
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Actions');
    });
  }

  it('creates the component', async () => {
    await setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('requests the detail with the offerId read from the route', async () => {
    await setup({ offerId: 'offer-77' });

    await vi.waitFor(() => {
      expect(offersApiMock.getOffer).toHaveBeenCalledWith('offer-77');
    });
  });

  it('shows a loading spinner while the detail query is pending', async () => {
    await setup({ detailResponse: new Observable() });
    expect(fixture.nativeElement.textContent).toContain("Chargement de l'offre");
  });

  it("shows the backend's translated message when the detail query fails", async () => {
    const errorResponse = new HttpErrorResponse({
      status: 404,
      error: {
        statusCode: 404,
        error: 'OFFER_NOT_FOUND',
        message: 'Cette offre est introuvable.',
        timestamp: '2026-07-16T00:00:00.000Z',
        path: '/recruiters/me/offers/offer-1',
      },
    });
    await setup({ detailResponse: throwError(() => errorResponse) });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Cette offre est introuvable.');
    });
  });

  it('renders offer details for a draft offer with edit and publish actions, no close action', async () => {
    await setup({ offer: buildOffer({ status: 'draft', title: 'Offre brouillon' }) });
    await waitForOfferLoaded();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Offre brouillon');
    expect(text).toContain('Brouillon');
    expect(query('#edit-button')).not.toBeNull();
    expect(query('#publish-button')).not.toBeNull();
    expect(query('#close-button')).toBeNull();
  });

  it('renders a published offer with a close action, no edit or publish action', async () => {
    await setup({ offer: buildOffer({ status: 'published' }) });
    await waitForOfferLoaded();

    expect(query('#edit-button')).toBeNull();
    expect(query('#publish-button')).toBeNull();
    expect(query('#close-button')).not.toBeNull();
  });

  it('renders a closed offer with no edit, publish or close action', async () => {
    await setup({ offer: buildOffer({ status: 'closed' }) });
    await waitForOfferLoaded();

    expect(query('#edit-button')).toBeNull();
    expect(query('#publish-button')).toBeNull();
    expect(query('#close-button')).toBeNull();
  });

  it('links to the candidates list of this offer', async () => {
    await setup({ offer: buildOffer({ id: 'offer-5' }) });
    await waitForOfferLoaded();

    expect(query<HTMLAnchorElement>('#candidates-link').getAttribute('href')).toBe(
      '/recruteur/offres/offer-5/candidats',
    );
  });

  it('publishes a draft offer', async () => {
    await setup({ offerId: 'offer-5', offer: buildOffer({ id: 'offer-5', status: 'draft' }) });
    await waitForOfferLoaded();
    offersApiMock.publishOffer.mockReturnValue(of(buildOffer({ id: 'offer-5', status: 'published' })));

    query<HTMLButtonElement>('#publish-button').click();

    await vi.waitFor(() => {
      expect(offersApiMock.publishOffer).toHaveBeenCalledWith('offer-5');
    });
  });

  it('closes a published offer', async () => {
    await setup({ offerId: 'offer-5', offer: buildOffer({ id: 'offer-5', status: 'published' }) });
    await waitForOfferLoaded();
    offersApiMock.closeOffer.mockReturnValue(of(buildOffer({ id: 'offer-5', status: 'closed' })));

    query<HTMLButtonElement>('#close-button').click();

    await vi.waitFor(() => {
      expect(offersApiMock.closeOffer).toHaveBeenCalledWith('offer-5');
    });
  });

  it('opens the edit form pre-filled with the current offer, and submits an OfferUpdateRequest', async () => {
    await setup({
      offerId: 'offer-5',
      offer: buildOffer({
        id: 'offer-5',
        status: 'draft',
        title: 'Titre initial',
        description: 'Description initiale',
        opportunityType: 'stage',
        location: 'Lomé',
        durationLabel: '1 mois',
        compensationLabel: '20000 FCFA',
      }),
    });
    await waitForOfferLoaded();

    query<HTMLButtonElement>('#edit-button').click();
    fixture.detectChanges();

    expect(query<HTMLInputElement>('#edit-title-input').value).toBe('Titre initial');
    expect(query<HTMLTextAreaElement>('#edit-description-textarea').value).toBe('Description initiale');

    const titleInput = query<HTMLInputElement>('#edit-title-input');
    titleInput.value = 'Titre modifié';
    titleInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    offersApiMock.updateOffer.mockReturnValue(
      of(buildOffer({ id: 'offer-5', status: 'draft', title: 'Titre modifié' })),
    );

    query<HTMLButtonElement>('#confirm-edit-button').click();

    await vi.waitFor(() => {
      expect(offersApiMock.updateOffer).toHaveBeenCalledWith('offer-5', {
        title: 'Titre modifié',
        description: 'Description initiale',
        opportunityType: 'stage',
        location: 'Lomé',
        durationLabel: '1 mois',
        compensationLabel: '20000 FCFA',
      });
    });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(query('#confirm-edit-button')).toBeNull();
    });
  });

  it('cancels the edit form without calling the mutation', async () => {
    await setup({ offer: buildOffer({ status: 'draft' }) });
    await waitForOfferLoaded();

    query<HTMLButtonElement>('#edit-button').click();
    fixture.detectChanges();
    expect(query('#confirm-edit-button')).not.toBeNull();

    query<HTMLButtonElement>('#cancel-edit-button').click();
    fixture.detectChanges();

    expect(query('#confirm-edit-button')).toBeNull();
    expect(offersApiMock.updateOffer).not.toHaveBeenCalled();
  });
});
