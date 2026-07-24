import { Routes } from '@angular/router';

/**
 * Routes du parcours d'offres et de candidatures étudiant (Épic 3). Exporte un tableau plat de
 * routes ENFANTS, destinées à être fusionnées par l'orchestrateur dans le tableau `children` de
 * la route `etudiant` déjà déclarée dans `app.routes.ts` (aux côtés de `dashboard`,
 * `verification`, `profil`, `urgence`) — ce fichier ne touche PAS `app.routes.ts`.
 *
 * Segments statiques (`offres`, `candidatures`) déclarés AVANT leurs segments paramétrés
 * respectifs (`offres/:offerId`, `candidatures/:applicationId`) : ordre sans ambiguïté ici (les
 * deux couples ne se chevauchent pas), mais gardé pour rester cohérent avec le principe déjà en
 * vigueur dans `app.routes.ts` (segments statiques avant tout catch-all `:id`).
 */
export const etudiantRoutes: Routes = [
  {
    path: 'offres',
    loadComponent: () => import('./offres/offer-list/offer-list').then((m) => m.OfferList),
  },
  {
    path: 'offres/:offerId',
    loadComponent: () => import('./offres/offer-detail/offer-detail').then((m) => m.OfferDetail),
  },
  {
    path: 'candidatures',
    loadComponent: () =>
      import('./candidatures/application-list/application-list').then((m) => m.ApplicationList),
  },
  {
    path: 'candidatures/:applicationId',
    loadComponent: () =>
      import('./candidatures/application-detail/application-detail').then(
        (m) => m.ApplicationDetail,
      ),
  },
];
