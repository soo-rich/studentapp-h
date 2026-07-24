import { inject } from '@angular/core';
import { injectMutation, injectQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';

import { OffersApiService } from './offers-api.service';
import { offersKeys } from './offers.keys';
import {
  Offer,
  OfferCreateRequest,
  OfferPage,
  OfferQueueParams,
  OfferUpdateRequest,
} from './offers.types';

/**
 * Composables TanStack Query pour le domaine `/recruiters/me/offers*` (offres du recruteur
 * courant). Chaque fonction `inject*` doit être appelée dans un contexte d'injection
 * (constructeur/champ de composant standalone, ou un autre composable appelé depuis un tel
 * contexte) — même contrainte que `injectQuery`/`injectMutation` eux-mêmes. Elles encapsulent
 * `OffersApiService` (accès HTTP brut) derrière le pattern query/mutation attendu par le
 * projet (voir CLAUDE.md — "tout appel API passe par TanStack Query"). Le Bearer est ajouté
 * automatiquement par `authInterceptor` (FE3) : aucun token géré manuellement ici.
 */

/**
 * `GET /recruiters/me/offers` — liste paginée des offres du recruteur courant. `params` est
 * une fonction (pas une valeur) pour que la query key et le refetch réagissent aux
 * changements de filtre/pagination (signal-based, cohérent avec
 * `injectModerationQueueQuery`).
 */
export function injectOffersQuery(params: () => OfferQueueParams) {
  const offersApi = inject(OffersApiService);

  return injectQuery(() => ({
    queryKey: offersKeys.list(params()),
    queryFn: (): Promise<OfferPage> => firstValueFrom(offersApi.listOffers(params())),
  }));
}

/**
 * `GET /recruiters/me/offers/{offerId}` — détail d'une offre du recruteur courant. Désactivée
 * tant que `offerId()` est `null` (ex. route pas encore résolue).
 */
export function injectOfferDetailQuery(offerId: () => string | null) {
  const offersApi = inject(OffersApiService);

  return injectQuery(() => ({
    queryKey: offersKeys.detail(offerId() ?? ''),
    queryFn: (): Promise<Offer> => firstValueFrom(offersApi.getOffer(offerId()!)),
    enabled: offerId() !== null,
  }));
}

/**
 * `POST /recruiters/me/offers` — crée une offre en brouillon. Invalide `offersKeys.all`
 * après succès (liste ET détail) pour refléter immédiatement la nouvelle offre.
 */
export function injectCreateOfferMutation() {
  const offersApi = inject(OffersApiService);
  const queryClient = inject(QueryClient);

  return injectMutation(() => ({
    mutationFn: (body: OfferCreateRequest): Promise<Offer> =>
      firstValueFrom(offersApi.createOffer(body)),
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: offersKeys.all });
    },
  }));
}

/** Variables de `injectUpdateOfferMutation` : offre ciblée + nouveau contenu. */
export interface UpdateOfferVariables {
  offerId: string;
  body: OfferUpdateRequest;
}

/**
 * `PATCH /recruiters/me/offers/{offerId}` — modifie une offre en brouillon. Invalide
 * `offersKeys.all` après succès (liste ET détail).
 */
export function injectUpdateOfferMutation() {
  const offersApi = inject(OffersApiService);
  const queryClient = inject(QueryClient);

  return injectMutation(() => ({
    mutationFn: ({ offerId, body }: UpdateOfferVariables): Promise<Offer> =>
      firstValueFrom(offersApi.updateOffer(offerId, body)),
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: offersKeys.all });
    },
  }));
}

/**
 * `POST /recruiters/me/offers/{offerId}/publish` — publie une offre en brouillon. Invalide
 * `offersKeys.all` après succès (liste ET détail).
 */
export function injectPublishOfferMutation() {
  const offersApi = inject(OffersApiService);
  const queryClient = inject(QueryClient);

  return injectMutation(() => ({
    mutationFn: (offerId: string): Promise<Offer> =>
      firstValueFrom(offersApi.publishOffer(offerId)),
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: offersKeys.all });
    },
  }));
}

/**
 * `POST /recruiters/me/offers/{offerId}/close` — ferme une offre publiée. Invalide
 * `offersKeys.all` après succès (liste ET détail).
 */
export function injectCloseOfferMutation() {
  const offersApi = inject(OffersApiService);
  const queryClient = inject(QueryClient);

  return injectMutation(() => ({
    mutationFn: (offerId: string): Promise<Offer> => firstValueFrom(offersApi.closeOffer(offerId)),
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: offersKeys.all });
    },
  }));
}
