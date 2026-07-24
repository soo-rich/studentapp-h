import { Routes } from '@angular/router';

/**
 * Routes du sous-module « candidatures » de la modération (Épic 3) — file
 * (`/moderation/candidatures`) + détail (`/moderation/candidatures/:applicationId`), réservé
 * au rôle `moderateur`.
 *
 * Fichier NEUF, NON câblé dans `app.routes.ts` — le montage (ajout de ces routes aux enfants
 * de la route `moderation` existante) reste du ressort de l'orchestrateur, hors périmètre de
 * cette tâche (voir CLAUDE.md et rapport de tâche). Pensé pour être ajouté via
 * `...moderationApplicationsRoutes` dans le tableau `children` de `app.routes.ts` (même
 * `roleGuard('moderateur')`, même `layouts/moderation-layout/` que les autres routes
 * `moderation`), AVANT le segment catch-all `:userId` — même piège déjà documenté dans
 * `app.routes.ts` : les segments statiques doivent précéder les paramètres dynamiques.
 *
 * Les composants (`applications-queue`, `applications-detail`) supposent ce montage : leurs
 * navigations pointent vers `/moderation/candidatures` et
 * `/moderation/candidatures/:applicationId`.
 */
export const moderationApplicationsRoutes: Routes = [
  {
    path: 'candidatures',
    loadComponent: () =>
      import('./applications-queue/applications-queue').then(
        (m) => m.ModerationApplicationsQueue,
      ),
  },
  {
    path: 'candidatures/:applicationId',
    loadComponent: () =>
      import('./applications-detail/applications-detail').then(
        (m) => m.ModerationApplicationsDetail,
      ),
  },
];
