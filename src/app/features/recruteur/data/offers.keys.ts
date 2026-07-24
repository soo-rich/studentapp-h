import type { OfferQueueParams } from './offers.types';

/**
 * Key factory TanStack Query pour le domaine `offers` (`/recruiters/me/offers*`, utilisateur
 * courant, rôle `recruteur`). Centralise les query keys pour garder cohérents
 * invalidation/refetch dans toute l'app (pattern recommandé par TanStack Query — voir
 * `features/moderation/data/moderation.keys.ts`).
 */
export const offersKeys = {
  all: ['recruiter-offers'] as const,
  list: (params: OfferQueueParams) => [...offersKeys.all, 'list', params] as const,
  detail: (offerId: string) => [...offersKeys.all, 'detail', offerId] as const,
};
