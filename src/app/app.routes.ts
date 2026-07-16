import { Routes } from '@angular/router';

import { roleGuard } from './core/auth/role.guard';

/**
 * Arborescence de routes par espace (Épic 0 — squelette de navigation) :
 * public / étudiant / recruteur / back-office modération. Chaque espace lazy-loade son
 * layout et ses pages ; les espaces protégés utilisent `roleGuard` (état d'auth STUB,
 * voir `core/auth/session.service.ts`).
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layouts/public-layout/public-layout').then((m) => m.PublicLayout),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/public/home/home').then((m) => m.Home),
      },
    ],
  },
  {
    path: 'etudiant',
    canActivate: [roleGuard('etudiant')],
    loadComponent: () =>
      import('./layouts/etudiant-layout/etudiant-layout').then((m) => m.EtudiantLayout),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/etudiant/dashboard/dashboard').then((m) => m.EtudiantDashboard),
      },
    ],
  },
  {
    path: 'recruteur',
    canActivate: [roleGuard('recruteur')],
    loadComponent: () =>
      import('./layouts/recruteur-layout/recruteur-layout').then((m) => m.RecruteurLayout),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/recruteur/dashboard/dashboard').then((m) => m.RecruteurDashboard),
      },
    ],
  },
  {
    path: 'moderation',
    canActivate: [roleGuard('moderateur')],
    loadComponent: () =>
      import('./layouts/moderation-layout/moderation-layout').then((m) => m.ModerationLayout),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/moderation/dashboard/dashboard').then((m) => m.ModerationDashboard),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
