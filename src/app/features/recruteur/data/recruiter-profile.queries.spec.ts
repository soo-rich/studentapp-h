import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { of } from 'rxjs';

import { RecruiterProfileApiService } from './recruiter-profile-api.service';
import { recruiterProfileKeys } from './recruiter-profile.keys';
import { injectUpsertRecruiterProfileMutation } from './recruiter-profile.queries';
import { RecruiterProfile, RecruiterProfileUpsertRequest } from './recruiter-profile.types';

/**
 * Couvre l'invalidation de cache `onSuccess` de `injectUpsertRecruiterProfileMutation` (même
 * stratégie que `features/moderation/data/moderation.queries.spec.ts`) : sans ce test,
 * supprimer le bloc `onSuccess` ne fait rougir aucun autre test — l'écran profil recruteur
 * afficherait alors des données périmées après un enregistrement, sans qu'aucune régression
 * ne soit détectée.
 *
 * `RecruiterProfileApiService` est intégralement mocké : seule la méthode exercée par la
 * mutation testée est fournie. `provideHttpClient`/`provideHttpClientTesting` sont conservés
 * pour rester cohérent avec la configuration de `recruiter-profile-api.service.spec.ts`, même
 * si aucune requête HTTP réelle n'est déclenchée ici (le service HTTP brut est remplacé par le
 * mock).
 */
describe('recruiter-profile.queries — invalidation du cache après succès', () => {
  let queryClient: QueryClient;
  let recruiterProfileApiMock: { upsertProfile: ReturnType<typeof vi.fn> };

  const profile: RecruiterProfile = {
    userId: 'user-1',
    structureName: 'Café Bon Accueil',
    structureType: 'restaurant',
    contactFirstName: 'Ama',
    contactLastName: 'Koffi',
    phoneNumber: '+228 90 00 00 00',
    location: 'Lomé, Agoè',
    description: null,
    updatedAt: '2026-07-16T00:00:00.000Z',
  };

  const upsertRequest: RecruiterProfileUpsertRequest = {
    structureName: 'Café Bon Accueil',
    structureType: 'restaurant',
    contactFirstName: 'Ama',
    contactLastName: 'Koffi',
    phoneNumber: '+228 90 00 00 00',
    location: 'Lomé, Agoè',
    description: null,
  };

  beforeEach(() => {
    queryClient = new QueryClient();
    recruiterProfileApiMock = { upsertProfile: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTanStackQuery(queryClient),
        { provide: RecruiterProfileApiService, useValue: recruiterProfileApiMock },
      ],
    });
  });

  it('injectUpsertRecruiterProfileMutation() invalidates recruiterProfileKeys.all after a successful upsert', async () => {
    recruiterProfileApiMock.upsertProfile.mockReturnValue(of(profile));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const mutation = TestBed.runInInjectionContext(() => injectUpsertRecruiterProfileMutation());
    mutation.mutate(upsertRequest);

    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: recruiterProfileKeys.all });
    });
  });
});
