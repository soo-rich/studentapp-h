import type { ModerationQueueParams, UrgentQueueParams } from './moderation.types';

/**
 * Key factory TanStack Query pour le domaine `moderation` (`/moderation/*`, réservé au rôle
 * `moderateur`). Centralise les query keys pour garder cohérents invalidation/refetch dans
 * toute l'app (pattern recommandé par TanStack Query — voir `core/auth/auth.keys.ts` et
 * `features/verification/data/verification.keys.ts`).
 */
export const moderationKeys = {
  all: ['moderation'] as const,
  verifications: (params: ModerationQueueParams) =>
    [...moderationKeys.all, 'verifications', params] as const,
  verification: (userId: string) => [...moderationKeys.all, 'verification', userId] as const,
  urgentQueue: (params: UrgentQueueParams) =>
    [...moderationKeys.all, 'urgent-requests', params] as const,
  studentProfile: (userId: string) =>
    [...moderationKeys.all, 'student-profile', userId] as const,
};
