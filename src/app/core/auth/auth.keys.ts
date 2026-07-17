/**
 * Key factory TanStack Query pour le domaine `auth`. Centralise les query keys pour garder
 * cohérents invalidation/refetch dans toute l'app (pattern recommandé par TanStack Query).
 *
 * `SessionService` (FE3) s'appuiera sur `authKeys.me()` pour invalider/rafraîchir
 * l'utilisateur courant après login/logout/refresh.
 */
export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
};
