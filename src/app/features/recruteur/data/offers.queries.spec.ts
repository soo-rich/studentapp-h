import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { of } from 'rxjs';

import { OffersApiService } from './offers-api.service';
import { offersKeys } from './offers.keys';
import {
  injectCloseOfferMutation,
  injectCreateOfferMutation,
  injectPublishOfferMutation,
  injectUpdateOfferMutation,
} from './offers.queries';
import { Offer, OfferCreateRequest } from './offers.types';

/**
 * Couvre l'invalidation de cache `onSuccess` des quatre mutations de `offers.queries.ts`
 * (même stratégie que `features/moderation/data/moderation.queries.spec.ts`) : sans ces
 * tests, supprimer un bloc `onSuccess` ne fait rougir aucun autre test — les écrans offres
 * (liste/détail) afficheraient alors des données périmées après une action, sans qu'aucune
 * régression ne soit détectée.
 *
 * `OffersApiService` est intégralement mocké : seules les méthodes exercées par les mutations
 * testées sont fournies.
 */
describe('offers.queries — invalidation du cache après succès', () => {
  let queryClient: QueryClient;
  let offersApiMock: {
    createOffer: ReturnType<typeof vi.fn>;
    updateOffer: ReturnType<typeof vi.fn>;
    publishOffer: ReturnType<typeof vi.fn>;
    closeOffer: ReturnType<typeof vi.fn>;
  };

  const offer: Offer = {
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
  };

  const createRequest: OfferCreateRequest = {
    title: offer.title,
    description: offer.description,
    opportunityType: offer.opportunityType,
    location: offer.location,
    durationLabel: offer.durationLabel,
    compensationLabel: offer.compensationLabel,
  };

  beforeEach(() => {
    queryClient = new QueryClient();
    offersApiMock = {
      createOffer: vi.fn(),
      updateOffer: vi.fn(),
      publishOffer: vi.fn(),
      closeOffer: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTanStackQuery(queryClient),
        { provide: OffersApiService, useValue: offersApiMock },
      ],
    });
  });

  it('injectCreateOfferMutation() invalidates offersKeys.all after a successful create', async () => {
    offersApiMock.createOffer.mockReturnValue(of(offer));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const mutation = TestBed.runInInjectionContext(() => injectCreateOfferMutation());
    mutation.mutate(createRequest);

    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: offersKeys.all });
    });
  });

  it('injectUpdateOfferMutation() invalidates offersKeys.all after a successful update', async () => {
    offersApiMock.updateOffer.mockReturnValue(of(offer));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const mutation = TestBed.runInInjectionContext(() => injectUpdateOfferMutation());
    mutation.mutate({ offerId: 'offer-1', body: createRequest });

    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: offersKeys.all });
    });
  });

  it('injectPublishOfferMutation() invalidates offersKeys.all after a successful publish', async () => {
    offersApiMock.publishOffer.mockReturnValue(of({ ...offer, status: 'published' as const }));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const mutation = TestBed.runInInjectionContext(() => injectPublishOfferMutation());
    mutation.mutate('offer-1');

    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: offersKeys.all });
    });
  });

  it('injectCloseOfferMutation() invalidates offersKeys.all after a successful close', async () => {
    offersApiMock.closeOffer.mockReturnValue(of({ ...offer, status: 'closed' as const }));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const mutation = TestBed.runInInjectionContext(() => injectCloseOfferMutation());
    mutation.mutate('offer-1');

    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: offersKeys.all });
    });
  });
});
