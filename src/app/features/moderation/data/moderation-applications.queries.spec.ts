import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { of } from 'rxjs';

import { ModerationApplicationsApiService } from './moderation-applications-api.service';
import { moderationApplicationsKeys } from './moderation-applications.keys';
import {
  injectApproveModerationApplicationMutation,
  injectRejectModerationApplicationMutation,
} from './moderation-applications.queries';
import { ModerationApplication, OfferSummary, StudentProfile } from './moderation-applications.types';

/**
 * Couvre l'invalidation de cache `onSuccess` des deux mutations de
 * `moderation-applications.queries.ts` (même besoin documenté par `moderation.queries.spec.ts`
 * T19 pour le domaine vérification/urgences) : sans cette spec, supprimer un bloc `onSuccess`
 * ne fait rougir aucun test — la file des candidatures afficherait alors des données périmées
 * après une approbation/un rejet sans qu'aucune régression ne soit détectée.
 *
 * `ModerationApplicationsApiService` est intégralement mocké (comme
 * `moderation.queries.spec.ts`) : seules les méthodes exercées par les mutations testées sont
 * fournies. On espionne `QueryClient.invalidateQueries` plutôt que d'observer un refetch réel,
 * même choix technique documenté dans `moderation.queries.spec.ts`.
 */
describe('moderation-applications.queries — invalidation du cache après succès', () => {
  let queryClient: QueryClient;
  let apiMock: { approve: ReturnType<typeof vi.fn>; reject: ReturnType<typeof vi.fn> };

  const offer: OfferSummary = {
    id: 'offer-1',
    title: 'Vendeur week-end',
    opportunityType: 'temps_partiel',
    structureName: 'Boutique ABC',
  };

  const student: StudentProfile = {
    userId: 'user-1',
    firstName: 'Awa',
    lastName: 'Koffi',
    university: 'Université de Lomé',
    studentCardNumber: 'UL-2026-001',
    fieldOfStudy: 'Informatique',
    studyLevel: 'Licence 3',
    skills: [],
    languages: [],
    residenceLocation: 'Lomé',
    opportunityTypes: ['temps_partiel'],
    availabilitySlots: [],
    sensitiveDataConsent: false,
    updatedAt: '2026-07-16T00:00:00.000Z',
  };

  const application: ModerationApplication = {
    id: 'application-1',
    offer,
    student,
    status: 'pending_moderation',
    message: null,
    rejectionReason: null,
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
  };

  beforeEach(() => {
    queryClient = new QueryClient();
    apiMock = { approve: vi.fn(), reject: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTanStackQuery(queryClient),
        { provide: ModerationApplicationsApiService, useValue: apiMock },
      ],
    });
  });

  it('injectApproveModerationApplicationMutation() invalidates moderationApplicationsKeys.all after a successful approve', async () => {
    apiMock.approve.mockReturnValue(of({ ...application, status: 'forwarded' }));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const mutation = TestBed.runInInjectionContext(() =>
      injectApproveModerationApplicationMutation(),
    );
    mutation.mutate('application-1');

    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: moderationApplicationsKeys.all });
    });
  });

  it('injectRejectModerationApplicationMutation() invalidates moderationApplicationsKeys.all after a successful reject', async () => {
    apiMock.reject.mockReturnValue(
      of({ ...application, status: 'rejected_moderation', rejectionReason: 'Motif' }),
    );
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const mutation = TestBed.runInInjectionContext(() =>
      injectRejectModerationApplicationMutation(),
    );
    mutation.mutate({ applicationId: 'application-1', reason: 'Motif' });

    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: moderationApplicationsKeys.all });
    });
  });
});
