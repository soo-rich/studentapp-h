import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';

import { GENERIC_ERROR_MESSAGE } from '../../../core/http/api-error';
import { injectOffersQuery } from '../data/offers.queries';
import { OfferStatus, OpportunityType } from '../data/offers.types';
import { OfferStatusBadge } from '../ui/offer-status-badge/offer-status-badge';

/** Libellés fr lisibles pour chaque `OpportunityType` du contrat (`offers.types.ts`). */
const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string> = {
  temps_partiel: 'Temps partiel',
  mission_ponctuelle: 'Mission ponctuelle',
  job_vacances: 'Job de vacances',
  stage: 'Stage',
};

/** Nombre d'offres par page — cohérent avec le défaut backend (`pageSize = 20`). */
const PAGE_SIZE = 20;

/** Valeur du filtre de statut représentant « toutes les offres » (pas de filtre envoyé). */
type StatusFilterValue = OfferStatus | 'all';

/** Option affichée dans le filtre de statut. */
interface StatusFilterOption {
  readonly value: StatusFilterValue;
  readonly label: string;
}

/** Filtre de statut : « Toutes » en premier et sélectionné par défaut. */
const STATUS_FILTER_OPTIONS: readonly StatusFilterOption[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'draft', label: 'Brouillons' },
  { value: 'published', label: 'Publiées' },
  { value: 'closed', label: 'Fermées' },
];

/**
 * Liste des offres du recruteur courant (Épic 3) : liste paginée
 * (`GET /recruiters/me/offers`) filtrable par statut, chaque carte menant au détail
 * (`/recruteur/offres/:offerId`), avec un lien vers la création (`/recruteur/offres/nouvelle`).
 * Consomme exclusivement la couche data livrée en amont (`offers.queries.ts`) — aucun
 * `HttpClient`/`fetch` direct ici.
 *
 * Route index de l'espace « offres » du recruteur (voir `recruteur.routes.ts`).
 */
@Component({
  selector: 'app-recruteur-offres',
  imports: [
    MatButtonModule,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
    RouterLink,
    OfferStatusBadge,
  ],
  templateUrl: './offres.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OffresList {
  protected readonly statusFilterOptions = STATUS_FILTER_OPTIONS;

  /** Statut sélectionné dans le filtre — « toutes » par défaut. */
  protected readonly status = signal<StatusFilterValue>('all');
  /** Page courante (1-indexée), remise à 1 à chaque changement de filtre. */
  protected readonly page = signal<number>(1);

  /**
   * Query TanStack `GET /recruiters/me/offers` (couche data amont) — `params` réagit à
   * `status`/`page` : tout changement de l'un ou l'autre régénère la query key et refetch.
   */
  protected readonly offersQuery = injectOffersQuery(() => {
    const status = this.status();
    return {
      status: status === 'all' ? undefined : status,
      page: this.page(),
      pageSize: PAGE_SIZE,
    };
  });

  /** Message d'erreur générique (`core/http/api-error`), `null` tant qu'aucune tentative n'a échoué. */
  protected readonly errorMessage = computed<string | null>(() =>
    this.offersQuery.error() === null ? null : GENERIC_ERROR_MESSAGE,
  );

  /** `true` si une page précédente existe (page courante > 1). */
  protected readonly canGoPrevious = computed<boolean>(() => this.page() > 1);

  /** `true` s'il reste des offres au-delà de la page courante (dérivé de `total`/`pageSize`). */
  protected readonly canGoNext = computed<boolean>(() => {
    const page = this.offersQuery.data();
    if (page === undefined) {
      return false;
    }
    return page.page * page.pageSize < page.total;
  });

  protected onStatusChange(change: MatButtonToggleChange): void {
    this.status.set(change.value as StatusFilterValue);
    this.page.set(1);
  }

  protected onPreviousPage(): void {
    if (this.canGoPrevious()) {
      this.page.update((current) => current - 1);
    }
  }

  protected onNextPage(): void {
    if (this.canGoNext()) {
      this.page.update((current) => current + 1);
    }
  }

  protected opportunityTypeLabel(type: OpportunityType): string {
    return OPPORTUNITY_TYPE_LABELS[type];
  }
}
