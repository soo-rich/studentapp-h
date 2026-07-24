import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { of } from 'rxjs';

import { PublicOffersApiService } from './public-offers-api.service';
import { injectPublicOfferDetailQuery, injectPublicOffersQuery } from './public-offers.queries';
import { PublicOffer, PublicOfferPage } from './public-offers.types';

/**
 * Couvre le comportement propre à `public-offers.queries.ts` : réactivité de `params()` pour
 * `injectPublicOffersQuery`, et désactivation de `injectPublicOfferDetailQuery` tant que
 * `offerId()` vaut `null` (pattern partagé avec `moderation.queries.ts` —
 * `injectVerificationDetailQuery`).
 */
describe('public-offers.queries', () => {
  let queryClient: QueryClient;
  let publicOffersApiMock: {
    listOffers: ReturnType<typeof vi.fn>;
    getOffer: ReturnType<typeof vi.fn>;
  };

  const offer: PublicOffer = {
    id: 'offer-1',
    title: 'Serveur en salle',
    description: 'Service en salle le week-end.',
    opportunityType: 'job_vacances',
    requiredSkills: ['Service client'],
    location: 'Lomé, Agoè',
    durationLabel: '3 mois',
    compensationLabel: '50 000 FCFA / mois',
    availabilitySlots: [],
    recruiter: {
      structureName: 'Le Bon Coin Resto',
      structureType: 'restaurant',
      location: 'Lomé, Agoè',
      description: null,
    },
    publishedAt: '2026-07-01T00:00:00.000Z',
  };

  const offerPage: PublicOfferPage = { items: [offer], page: 1, pageSize: 20, total: 1 };

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    publicOffersApiMock = {
      listOffers: vi.fn().mockReturnValue(of(offerPage)),
      getOffer: vi.fn().mockReturnValue(of(offer)),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTanStackQuery(queryClient),
        { provide: PublicOffersApiService, useValue: publicOffersApiMock },
      ],
    });
  });

  it('injectPublicOffersQuery() calls listOffers with the current params() on each evaluation', async () => {
    const params = { opportunityType: 'job_vacances' as const, page: 2, pageSize: 20 };

    TestBed.runInInjectionContext(() => injectPublicOffersQuery(() => params));

    await vi.waitFor(() => {
      expect(publicOffersApiMock.listOffers).toHaveBeenCalledWith(params);
    });
  });

  it('injectPublicOfferDetailQuery() does not call getOffer while offerId() is null', () => {
    TestBed.runInInjectionContext(() => injectPublicOfferDetailQuery(() => null));

    expect(publicOffersApiMock.getOffer).not.toHaveBeenCalled();
  });

  it('injectPublicOfferDetailQuery() calls getOffer with the resolved offerId once it is non-null', async () => {
    TestBed.runInInjectionContext(() => injectPublicOfferDetailQuery(() => 'offer-1'));

    await vi.waitFor(() => {
      expect(publicOffersApiMock.getOffer).toHaveBeenCalledWith('offer-1');
    });
  });
});
