import { inject } from '@angular/core';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';

import { PublicOffersApiService } from './public-offers-api.service';
import { publicOffersKeys } from './public-offers.keys';
import { PublicOffer, PublicOfferListParams, PublicOfferPage } from './public-offers.types';

/**
 * Composables TanStack Query pour le domaine `/offers*` (offres publiées, rôle `etudiant`).
 * Chaque fonction `inject*` doit être appelée dans un contexte d'injection (constructeur/champ
 * de composant standalone, ou un autre composable appelé depuis un tel contexte) — même
 * contrainte que `injectQuery`/`injectMutation` eux-mêmes. Elles encapsulent
 * `PublicOffersApiService` (accès HTTP brut) derrière le pattern query attendu par le projet
 * (voir CLAUDE.md — "tout appel API passe par TanStack Query"). Le Bearer est ajouté
 * automatiquement par `authInterceptor` (FE3) : aucun token géré manuellement ici.
 */

/**
 * `GET /offers` — page d'offres publiées. `params` est une fonction (pas une valeur) pour que
 * la query key et le refetch réagissent aux changements de filtre/pagination (signal-based,
 * cohérent avec `injectModerationQueueQuery`).
 */
export function injectPublicOffersQuery(params: () => PublicOfferListParams) {
  const publicOffersApi = inject(PublicOffersApiService);

  return injectQuery(() => ({
    queryKey: publicOffersKeys.list(params()),
    queryFn: (): Promise<PublicOfferPage> => firstValueFrom(publicOffersApi.listOffers(params())),
  }));
}

/**
 * `GET /offers/{offerId}` — détail d'une offre publiée. Désactivée tant que `offerId()` est
 * `null` (ex. paramètre de route pas encore résolu), même contrainte que
 * `injectVerificationDetailQuery`.
 */
export function injectPublicOfferDetailQuery(offerId: () => string | null) {
  const publicOffersApi = inject(PublicOffersApiService);

  return injectQuery(() => ({
    queryKey: publicOffersKeys.detail(offerId() ?? ''),
    queryFn: (): Promise<PublicOffer> => firstValueFrom(publicOffersApi.getOffer(offerId()!)),
    enabled: offerId() !== null,
  }));
}
