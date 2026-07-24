import type { PublicOfferListParams } from './public-offers.types';

/**
 * Key factory TanStack Query pour le domaine `offers` (`/offers`, `/offers/{offerId}`, rôle
 * `etudiant`). Centralise les query keys pour garder cohérents invalidation/refetch dans toute
 * l'app (pattern recommandé par TanStack Query — voir `features/moderation/data/moderation.keys.ts`).
 */
export const publicOffersKeys = {
  all: ['public-offers'] as const,
  list: (params: PublicOfferListParams) => [...publicOffersKeys.all, 'list', params] as const,
  detail: (offerId: string) => [...publicOffersKeys.all, 'detail', offerId] as const,
};
