import { Routes } from '@angular/router';

import { roleGuard } from './core/auth/role.guard';
import { etudiantRoutes } from './features/etudiant/etudiant.routes';
import { moderationApplicationsRoutes } from './features/moderation/moderation-applications.routes';
import { recruteurRoutes } from './features/recruteur/recruteur.routes';

/**
 * Arborescence de routes par espace (Épic 1) : public / étudiant / recruteur / back-office
 * modération. Chaque espace lazy-loade son layout et ses pages ; les espaces protégés
 * utilisent `roleGuard` (état d'auth STUB, voir `core/auth/session.service.ts`).
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
      {
        path: 'login',
        loadComponent: () => import('./features/public/login/login').then((m) => m.Login),
      },
      {
        path: 'register-etudiant',
        loadComponent: () =>
          import('./features/public/register-etudiant/register-etudiant').then(
            (m) => m.RegisterEtudiant,
          ),
      },
      {
        path: 'register-recruteur',
        loadComponent: () =>
          import('./features/public/register-recruteur/register-recruteur').then(
            (m) => m.RegisterRecruteur,
          ),
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
      {
        path: 'verification',
        loadComponent: () =>
          import('./features/verification/ui/verification-documents/verification-documents').then(
            (m) => m.VerificationDocuments,
          ),
      },
      {
        path: 'profil',
        loadComponent: () =>
          import('./features/profile/ui/student-profile-form/student-profile-form').then(
            (m) => m.StudentProfileForm,
          ),
      },
      {
        path: 'urgence',
        loadComponent: () =>
          import('./features/urgent-request/ui/urgent-request-page/urgent-request-page').then(
            (m) => m.UrgentRequestPage,
          ),
      },
      // Parcours d'offres et candidatures étudiant (Épic 3).
      ...etudiantRoutes,
    ],
  },
  {
    path: 'recruteur',
    canActivate: [roleGuard('recruteur')],
    loadComponent: () =>
      import('./layouts/recruteur-layout/recruteur-layout').then((m) => m.RecruteurLayout),
    // Dashboard, vérification, profil recruteur, offres et candidats (Épic 3).
    children: recruteurRoutes,
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
          import('./features/moderation/queue/queue').then((m) => m.ModerationQueue),
      },
      // Les segments statiques DOIVENT précéder `:userId` : ce paramètre est un
      // catch-all qui capturerait sinon « urgences » et « etudiants » comme des
      // identifiants d'utilisateur.
      {
        path: 'urgences',
        loadComponent: () =>
          import('./features/moderation/urgent-queue/urgent-queue').then((m) => m.UrgentQueue),
      },
      {
        path: 'etudiants/:userId',
        loadComponent: () =>
          import('./features/moderation/student-profile/student-profile').then(
            (m) => m.ModerationStudentProfile,
          ),
      },
      // File de candidatures (Épic 3) — segments statiques, doivent précéder `:userId`.
      ...moderationApplicationsRoutes,
      {
        path: ':userId',
        loadComponent: () =>
          import('./features/moderation/detail/detail').then((m) => m.ModerationDetail),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
