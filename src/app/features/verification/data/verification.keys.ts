/**
 * Key factory TanStack Query pour le domaine `verification` (`/verification/documents*`,
 * utilisateur courant). Centralise les query keys pour garder cohérents invalidation/refetch
 * dans toute l'app (pattern recommandé par TanStack Query — voir `core/auth/auth.keys.ts`).
 */
export const verificationKeys = {
  all: ['verification'] as const,
  documents: () => [...verificationKeys.all, 'documents'] as const,
};
