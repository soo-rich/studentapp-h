/**
 * Key factory TanStack Query pour le domaine `profile` (`/students/me/profile`, utilisateur
 * courant, rôle `etudiant`). Centralise les query keys pour garder cohérents
 * invalidation/refetch dans toute l'app (pattern recommandé par TanStack Query — voir
 * `core/auth/auth.keys.ts` et `features/verification/data/verification.keys.ts`).
 */
export const profileKeys = {
  all: ['profile'] as const,
  me: () => [...profileKeys.all, 'me'] as const,
};
