import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';

import { GENERIC_ERROR_MESSAGE } from '../../../../core/http/api-error';
import { injectStudentApplicationsQuery } from '../../data/applications.queries';
import { ApplicationStatus } from '../../data/applications.types';

/** Nombre de candidatures par page — fixe, pas encore piloté par l'UI (cohérent avec `moderation/queue`). */
const PAGE_SIZE = 20;

/** Option affichée dans le filtre de statut. `''` = pas de filtre (tous les statuts). */
interface StatusFilterOption {
  readonly value: ApplicationStatus | '';
  readonly label: string;
}

const STATUS_FILTER_OPTIONS: readonly StatusFilterOption[] = [
  { value: '', label: 'Tous les statuts' },
  { value: 'pending_moderation', label: 'En attente de modération' },
  { value: 'forwarded', label: 'Transmise au recruteur' },
  { value: 'rejected_moderation', label: 'Recalée par la modération' },
  { value: 'selected', label: 'Sélectionnée par le recruteur' },
  { value: 'accepted', label: 'Mise en relation acceptée' },
  { value: 'declined', label: 'Mise en relation refusée' },
  { value: 'rejected_by_recruiter', label: 'Écartée par le recruteur' },
  { value: 'withdrawn', label: 'Retirée' },
];

/** Libellés fr lisibles pour chaque `ApplicationStatus` du contrat (`applications.types.ts`). */
const STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending_moderation: 'En attente de modération',
  forwarded: 'Transmise au recruteur',
  rejected_moderation: 'Recalée par la modération',
  selected: 'Sélectionnée par le recruteur',
  accepted: 'Mise en relation acceptée',
  declined: 'Mise en relation refusée',
  rejected_by_recruiter: 'Écartée par le recruteur',
  withdrawn: 'Retirée',
};

/** Classes Tailwind du badge de statut, par statut — ton factuel, pas de sur-dramatisation. */
const STATUS_BADGE_CLASSES: Record<ApplicationStatus, string> = {
  pending_moderation: 'bg-amber-50 text-amber-700',
  forwarded: 'bg-blue-50 text-blue-700',
  rejected_moderation: 'bg-red-50 text-red-700',
  selected: 'bg-blue-50 text-blue-700',
  accepted: 'bg-green-50 text-green-700',
  declined: 'bg-gray-100 text-gray-600',
  rejected_by_recruiter: 'bg-red-50 text-red-700',
  withdrawn: 'bg-gray-100 text-gray-600',
};

/**
 * Mes candidatures (Épic 3) : liste paginée (`GET /students/me/applications`) filtrable par
 * statut, chaque ligne menant au détail (`/etudiant/candidatures/:applicationId`). Consomme
 * exclusivement la couche data livrée en amont (`applications.queries.ts`) — aucun
 * `HttpClient`/`fetch` direct ici.
 *
 * `rejectionReason` n'est affiché que pour les candidatures au statut `rejected_moderation`
 * (voir contrat `StudentApplication.rejectionReason` — renseigné uniquement dans ce cas).
 */
@Component({
  selector: 'app-application-list',
  imports: [
    DatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    RouterLink,
  ],
  templateUrl: './application-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationList {
  protected readonly statusFilterOptions = STATUS_FILTER_OPTIONS;

  /** Statut sélectionné dans le filtre — `''` (tous les statuts) par défaut. */
  protected readonly status = signal<ApplicationStatus | ''>('');
  /** Page courante (1-indexée), remise à 1 à chaque changement de filtre. */
  protected readonly page = signal<number>(1);

  /**
   * Query TanStack `GET /students/me/applications` (couche data amont) — `params` réagit à
   * `status`/`page` : tout changement de l'un ou l'autre régénère la query key et refetch.
   */
  protected readonly applicationsQuery = injectStudentApplicationsQuery(() => {
    const status = this.status();
    return {
      status: status === '' ? undefined : status,
      page: this.page(),
      pageSize: PAGE_SIZE,
    };
  });

  /**
   * Message d'erreur générique (`core/http/api-error`), `null` tant qu'aucune tentative n'a
   * échoué — même choix que `moderation/queue` (pas de parsing du corps de l'erreur pour un
   * simple écran de liste).
   */
  protected readonly errorMessage = computed<string | null>(() =>
    this.applicationsQuery.error() === null ? null : GENERIC_ERROR_MESSAGE,
  );

  /** `true` si une page précédente existe (page courante > 1). */
  protected readonly canGoPrevious = computed<boolean>(() => this.page() > 1);

  /** `true` s'il reste des candidatures au-delà de la page courante (dérivé de `total`/`pageSize`). */
  protected readonly canGoNext = computed<boolean>(() => {
    const page = this.applicationsQuery.data();
    if (page === undefined) {
      return false;
    }
    return page.page * page.pageSize < page.total;
  });

  protected onStatusChange(change: MatSelectChange): void {
    this.status.set(change.value as ApplicationStatus | '');
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

  protected statusLabel(status: ApplicationStatus): string {
    return STATUS_LABELS[status];
  }

  protected statusBadgeClasses(status: ApplicationStatus): string {
    return STATUS_BADGE_CLASSES[status];
  }
}
