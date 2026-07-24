/**
 * Key factory TanStack Query pour le domaine `recruiter-profile` (`/recruiters/me/profile`,
 * utilisateur courant, rôle `recruteur`). Centralise les query keys pour garder cohérents
 * invalidation/refetch dans toute l'app (pattern recommandé par TanStack Query — voir
 * `features/profile/data/profile.keys.ts`).
 */
export const recruiterProfileKeys = {
  all: ['recruiter-profile'] as const,
  me: () => [...recruiterProfileKeys.all, 'me'] as const,
};
