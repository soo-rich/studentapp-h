import { Routes } from '@angular/router';

/**
 * Arborescence de routes de l'espace recruteur (Épic 3). Exportée pour être câblée par
 * l'orchestrateur sous le path protégé `/recruteur` (voir `app.routes.ts` — hors périmètre de
 * cette tâche, wiring réservé à l'orchestrateur).
 *
 * Les segments statiques (`profil`, `offres`, `offres/nouvelle`) précèdent volontairement
 * `offres/:offerId` et `offres/:offerId/candidats` : `:offerId` est un catch-all qui
 * capturerait sinon `nouvelle` comme un identifiant d'offre (même piège documenté dans
 * `app.routes.ts` pour l'espace modération — voir `urgences`/`etudiants/:userId` vs `:userId`).
 */
export const recruteurRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./dashboard/dashboard').then((m) => m.RecruteurDashboard),
  },
  {
    path: 'verification',
    loadComponent: () =>
      import('../verification/ui/verification-documents/verification-documents').then(
        (m) => m.VerificationDocuments,
      ),
  },
  {
    path: 'profil',
    loadComponent: () => import('./profil/profil').then((m) => m.RecruteurProfil),
  },
  {
    path: 'offres',
    loadComponent: () => import('./offres/offres').then((m) => m.OffresList),
  },
  {
    path: 'offres/nouvelle',
    loadComponent: () => import('./offres/nouvelle/nouvelle').then((m) => m.NouvelleOffre),
  },
  {
    path: 'offres/:offerId',
    loadComponent: () => import('./offres/detail/detail').then((m) => m.OffreDetail),
  },
  {
    path: 'offres/:offerId/candidats',
    loadComponent: () => import('./offres/candidats/candidats').then((m) => m.OffreCandidats),
  },
];
