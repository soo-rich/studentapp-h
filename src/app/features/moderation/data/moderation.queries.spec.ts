import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { of } from 'rxjs';

import { User } from '../../../core/auth/auth.types';
import { ModerationApiService } from './moderation-api.service';
import { moderationKeys } from './moderation.keys';
import {
  injectApproveVerificationMutation,
  injectRejectVerificationMutation,
  injectReviewUrgentRequestMutation,
} from './moderation.queries';
import { ModerationUrgentRequest } from './moderation.types';

/**
 * Backfill T19 : couvre l'invalidation de cache `onSuccess` des trois mutations de
 * `moderation.queries.ts`. Sans cette spec, supprimer un bloc `onSuccess` ne fait rougir
 * aucun test — la file de modération afficherait alors des données périmées après une
 * action (approbation/rejet/traitement d'urgence) sans qu'aucune régression ne soit détectée.
 *
 * Choix technique : on espionne `QueryClient.invalidateQueries` (`vi.spyOn`) plutôt que
 * d'observer un refetch réel via `HttpTestingController`. Un refetch réel demanderait de
 * garder `enabled`/un composant monté pour la query invalidée (ex. `injectModerationQueueQuery`)
 * et de flush un second cycle de requête HTTP — complexité additionnelle qui n'apporte rien de
 * plus que l'assertion directe sur l'appel `invalidateQueries({ queryKey: moderationKeys.all })`,
 * qui est exactement ce que le code de `moderation.queries.ts` fait (et documente faire) dans
 * chaque `onSuccess`. L'espion est aussi plus robuste : il ne dépend pas d'un flush d'effects
 * Angular (le callback `onSuccess` d'une mutation TanStack Query est invoqué par le coeur
 * `@tanstack/query-core`, indépendamment du framework — voir `inject-mutation.mjs`), seulement
 * de la résolution de la promesse HTTP mockée (d'où le `vi.waitFor` ci-dessous, pour ne pas
 * asserter avant le dispatch asynchrone de `mutate()`, piège déjà documenté dans ce repo).
 *
 * `ModerationApiService` est intégralement mocké (comme dans `detail.spec.ts`) : seules les
 * méthodes exercées par les mutations testées sont fournies. `provideHttpClient`/
 * `provideHttpClientTesting` sont conservés pour rester cohérent avec la configuration de
 * `moderation-api.service.spec.ts`, même si aucune requête HTTP réelle n'est déclenchée ici
 * (le service HTTP brut est remplacé par le mock).
 */
describe('moderation.queries — invalidation du cache après succès', () => {
  let queryClient: QueryClient;
  let moderationApiMock: {
    approve: ReturnType<typeof vi.fn>;
    reject: ReturnType<typeof vi.fn>;
    reviewUrgentRequest: ReturnType<typeof vi.fn>;
  };

  const user: User = {
    id: 'user-1',
    email: 'etudiant@example.com',
    role: 'etudiant',
    verificationStatus: 'verified',
    createdAt: '2026-07-16T00:00:00.000Z',
  };

  const urgentRequest: ModerationUrgentRequest = {
    id: 'urgent-1',
    status: 'prioritized',
    message: 'Besoin urgent de conseils, situation difficile.',
    moderatorNote: 'Cas prioritaire',
    user,
    createdAt: '2026-07-16T00:00:00.000Z',
    reviewedAt: '2026-07-17T00:00:00.000Z',
  };

  beforeEach(() => {
    queryClient = new QueryClient();
    moderationApiMock = {
      approve: vi.fn(),
      reject: vi.fn(),
      reviewUrgentRequest: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTanStackQuery(queryClient),
        { provide: ModerationApiService, useValue: moderationApiMock },
      ],
    });
  });

  it('injectApproveVerificationMutation() invalidates moderationKeys.all after a successful approve', async () => {
    moderationApiMock.approve.mockReturnValue(of({ ...user, verificationStatus: 'verified' }));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const mutation = TestBed.runInInjectionContext(() => injectApproveVerificationMutation());
    mutation.mutate('user-1');

    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: moderationKeys.all });
    });
  });

  it('injectRejectVerificationMutation() invalidates moderationKeys.all after a successful reject', async () => {
    moderationApiMock.reject.mockReturnValue(of({ ...user, verificationStatus: 'rejected' }));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const mutation = TestBed.runInInjectionContext(() => injectRejectVerificationMutation());
    mutation.mutate({ userId: 'user-1', reason: 'Document illisible' });

    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: moderationKeys.all });
    });
  });

  it('injectReviewUrgentRequestMutation() invalidates moderationKeys.all after a successful review', async () => {
    moderationApiMock.reviewUrgentRequest.mockReturnValue(of(urgentRequest));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const mutation = TestBed.runInInjectionContext(() => injectReviewUrgentRequestMutation());
    mutation.mutate({ id: 'urgent-1', body: { decision: 'prioritize', note: 'Cas prioritaire' } });

    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: moderationKeys.all });
    });
  });
});
