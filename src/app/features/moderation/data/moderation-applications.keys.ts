import type { ModerationApplicationsQueueParams } from './moderation-applications.types';

/**
 * Key factory TanStack Query pour le domaine `applications` de la modération
 * (`/moderation/applications/*`, réservé au rôle `moderateur` — Épic 3). Fichier NEUF,
 * volontairement séparé de `moderation.keys.ts` (file de vérification/urgences, Épic 1/2) —
 * racine de clé distincte (`moderation-applications`, pas nichée sous `moderationKeys.all`)
 * pour ne pas interférer avec les invalidations croisées : approuver/rejeter une candidature
 * ne doit pas provoquer de refetch de la file de vérification, et inversement.
 */
export const moderationApplicationsKeys = {
  all: ['moderation-applications'] as const,
  list: (params: ModerationApplicationsQueueParams) =>
    [...moderationApplicationsKeys.all, 'list', params] as const,
  detail: (applicationId: string) =>
    [...moderationApplicationsKeys.all, 'detail', applicationId] as const,
};
