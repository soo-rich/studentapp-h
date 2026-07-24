import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { of } from 'rxjs';

import { ApplicationsApiService } from './applications-api.service';
import { applicationsKeys } from './applications.keys';
import {
  injectAcceptApplicationMutation,
  injectApplyMutation,
  injectDeclineApplicationMutation,
  injectWithdrawApplicationMutation,
} from './applications.queries';
import { StudentApplication } from './applications.types';

/**
 * Couvre l'invalidation de cache `onSuccess` des quatre mutations de `applications.queries.ts`
 * — sans cette spec, supprimer un bloc `onSuccess` ne fait rougir aucun test — la liste/le
 * détail des candidatures afficheraient alors des données périmées après une action (dépôt,
 * retrait, acceptation, refus) sans qu'aucune régression ne soit détectée. Même choix technique
 * que `features/moderation/data/moderation.queries.spec.ts` (T19) : on espionne
 * `QueryClient.invalidateQueries` plutôt que d'observer un refetch réel via
 * `HttpTestingController`.
 */
describe('applications.queries — invalidation du cache après succès', () => {
  let queryClient: QueryClient;
  let applicationsApiMock: {
    apply: ReturnType<typeof vi.fn>;
    withdraw: ReturnType<typeof vi.fn>;
    accept: ReturnType<typeof vi.fn>;
    decline: ReturnType<typeof vi.fn>;
  };

  const application: StudentApplication = {
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
  };

  beforeEach(() => {
    queryClient = new QueryClient();
    applicationsApiMock = {
      apply: vi.fn(),
      withdraw: vi.fn(),
      accept: vi.fn(),
      decline: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTanStackQuery(queryClient),
        { provide: ApplicationsApiService, useValue: applicationsApiMock },
      ],
    });
  });

  it('injectApplyMutation() invalidates applicationsKeys.all after a successful apply', async () => {
    applicationsApiMock.apply.mockReturnValue(of(application));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const mutation = TestBed.runInInjectionContext(() => injectApplyMutation());
    mutation.mutate({ offerId: 'offer-1', body: { message: null } });

    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: applicationsKeys.all });
    });
  });

  it('injectWithdrawApplicationMutation() invalidates applicationsKeys.all after a successful withdraw', async () => {
    applicationsApiMock.withdraw.mockReturnValue(of(undefined));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const mutation = TestBed.runInInjectionContext(() => injectWithdrawApplicationMutation());
    mutation.mutate('app-1');

    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: applicationsKeys.all });
    });
  });

  it('injectAcceptApplicationMutation() invalidates applicationsKeys.all after a successful accept', async () => {
    applicationsApiMock.accept.mockReturnValue(of({ ...application, status: 'accepted' }));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const mutation = TestBed.runInInjectionContext(() => injectAcceptApplicationMutation());
    mutation.mutate('app-1');

    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: applicationsKeys.all });
    });
  });

  it('injectDeclineApplicationMutation() invalidates applicationsKeys.all after a successful decline', async () => {
    applicationsApiMock.decline.mockReturnValue(of({ ...application, status: 'declined' }));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const mutation = TestBed.runInInjectionContext(() => injectDeclineApplicationMutation());
    mutation.mutate('app-1');

    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: applicationsKeys.all });
    });
  });
});
