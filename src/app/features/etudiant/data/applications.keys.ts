import type { StudentApplicationListParams } from './applications.types';

/**
 * Key factory TanStack Query pour le domaine `applications` (`/offers/{offerId}/applications`,
 * `/students/me/applications*`, rôle `etudiant`). Centralise les query keys pour garder
 * cohérents invalidation/refetch dans toute l'app (pattern recommandé par TanStack Query — voir
 * `features/moderation/data/moderation.keys.ts`).
 */
export const applicationsKeys = {
  all: ['applications'] as const,
  list: (params: StudentApplicationListParams) =>
    [...applicationsKeys.all, 'list', params] as const,
  detail: (applicationId: string) => [...applicationsKeys.all, 'detail', applicationId] as const,
};
