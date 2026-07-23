/**
 * Key factory TanStack Query pour le domaine `urgent-request` (`/students/me/urgent-request`,
 * utilisateur courant). Centralise les query keys pour garder cohérents invalidation/refetch
 * dans toute l'app (pattern recommandé par TanStack Query — voir
 * `features/verification/data/verification.keys.ts`).
 */
export const urgentRequestKeys = {
  all: ['urgent-request'] as const,
  me: () => [...urgentRequestKeys.all, 'me'] as const,
};
