import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { of } from 'rxjs';

import { CandidatesApiService } from './candidates-api.service';
import { candidatesKeys } from './candidates.keys';
import { injectSelectCandidateMutation } from './candidates.queries';
import { CandidateCard } from './candidates.types';
import { offersKeys } from './offers.keys';

/**
 * Couvre l'invalidation de cache `onSuccess` de `injectSelectCandidateMutation` (même
 * stratégie que `features/moderation/data/moderation.queries.spec.ts`) : sans ce test,
 * supprimer un bloc `onSuccess` ne fait rougir aucun autre test — la liste des candidats
 * afficherait alors un statut périmé après une sélection, sans qu'aucune régression ne soit
 * détectée. Vérifie aussi l'invalidation croisée de `offersKeys.all` (l'offre affiche des
 * compteurs qui peuvent dépendre de l'état des candidatures).
 *
 * `CandidatesApiService` est intégralement mocké : seule la méthode exercée par la mutation
 * testée est fournie.
 */
describe('candidates.queries — invalidation du cache après succès', () => {
  let queryClient: QueryClient;
  let candidatesApiMock: { selectCandidate: ReturnType<typeof vi.fn> };

  const candidate: CandidateCard = {
    applicationId: 'application-1',
    status: 'selected',
    university: 'Université de Lomé',
    fieldOfStudy: 'Informatique',
    studyLevel: 'Licence 3',
    skills: [],
    languages: [],
    experiences: null,
    opportunityTypes: ['job_vacances'],
    availabilitySlots: [],
    residenceArea: 'Lomé, Agoè',
  };

  beforeEach(() => {
    queryClient = new QueryClient();
    candidatesApiMock = { selectCandidate: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTanStackQuery(queryClient),
        { provide: CandidatesApiService, useValue: candidatesApiMock },
      ],
    });
  });

  it('injectSelectCandidateMutation() invalidates candidatesKeys.all and offersKeys.all after a successful select', async () => {
    candidatesApiMock.selectCandidate.mockReturnValue(of(candidate));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const mutation = TestBed.runInInjectionContext(() => injectSelectCandidateMutation());
    mutation.mutate({ offerId: 'offer-1', applicationId: 'application-1' });

    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: candidatesKeys.all });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: offersKeys.all });
    });
  });
});
