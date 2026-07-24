import type { CandidateQueueParams } from './candidates.types';

/**
 * Key factory TanStack Query pour le domaine `candidates`
 * (`/recruiters/me/offers/{offerId}/candidates*`, rôle `recruteur`). Centralise les query
 * keys pour garder cohérents invalidation/refetch dans toute l'app (pattern recommandé par
 * TanStack Query — voir `features/moderation/data/moderation.keys.ts`).
 */
export const candidatesKeys = {
  all: ['recruiter-candidates'] as const,
  list: (offerId: string, params: CandidateQueueParams) =>
    [...candidatesKeys.all, 'list', offerId, params] as const,
  contact: (offerId: string, applicationId: string) =>
    [...candidatesKeys.all, 'contact', offerId, applicationId] as const,
};
