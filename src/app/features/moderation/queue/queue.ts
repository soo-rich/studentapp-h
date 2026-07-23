import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';

import { Role } from '../../../core/auth/role';
import { VerificationBadge } from '../../../shared/verification-badge/verification-badge';
import { injectModerationQueueQuery } from '../data/moderation.queries';
import { VerificationStatus } from '../data/moderation.types';

/** Nombre de demandes par page — fixe, pas encore piloté par l'UI (voir brief T4). */
const PAGE_SIZE = 20;

/** Option affichée dans le filtre de statut. */
interface StatusFilterOption {
  readonly value: VerificationStatus;
  readonly label: string;
}

/** Filtre de statut : `pending` en premier et sélectionné par défaut, voir brief T4. */
const STATUS_FILTER_OPTIONS: readonly StatusFilterOption[] = [
  { value: 'pending', label: 'En attente' },
  { value: 'verified', label: 'Vérifiés' },
  { value: 'rejected', label: 'Rejetés' },
];

/** Libellés fr lisibles pour chaque rôle (`components.schemas.Role` du contrat). */
const ROLE_LABELS: Record<Role, string> = {
  etudiant: 'Étudiant',
  recruteur: 'Recruteur',
  moderateur: 'Modérateur',
};

/**
 * Message d'erreur générique affiché en cas d'échec du chargement de la file — pas de
 * parsing du corps de l'erreur ici (contrairement à l'écran détail) : un simple message
 * générique suffit pour cet écran de liste, voir brief T4 ("erreur : message générique").
 */
const GENERIC_ERROR_MESSAGE = 'Une erreur est survenue. Réessaie dans un instant.';

/**
 * File de vérification (back-office modération, T4/Épic 1) : liste paginée des demandes
 * (`GET /moderation/verifications`) filtrable par statut, chaque ligne menant au détail
 * (`/moderation/:userId`). Consomme exclusivement la couche data livrée en amont
 * (`moderation.queries.ts`) — aucun `HttpClient`/`fetch` direct ici.
 *
 * Route index de l'espace modération (`/moderation`, voir `app.routes.ts` — câblage T5).
 */
@Component({
  selector: 'app-moderation-queue',
  imports: [
    DatePipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
    RouterLink,
    VerificationBadge,
  ],
  templateUrl: './queue.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModerationQueue {
  protected readonly statusFilterOptions = STATUS_FILTER_OPTIONS;

  /** Statut sélectionné dans le filtre — `pending` par défaut (brief T4). */
  protected readonly status = signal<VerificationStatus>('pending');
  /** Page courante (1-indexée), remise à 1 à chaque changement de filtre. */
  protected readonly page = signal<number>(1);

  /**
   * Query TanStack `GET /moderation/verifications` (couche data amont) — `params` réagit à
   * `status`/`page` : tout changement de l'un ou l'autre régénère la query key et refetch.
   */
  protected readonly queueQuery = injectModerationQueueQuery(() => ({
    status: this.status(),
    page: this.page(),
    pageSize: PAGE_SIZE,
  }));

  /** Message d'erreur générique, `null` tant qu'aucune tentative n'a échoué. */
  protected readonly errorMessage = computed<string | null>(() =>
    this.queueQuery.error() === null ? null : GENERIC_ERROR_MESSAGE,
  );

  /** `true` si une page précédente existe (page courante > 1). */
  protected readonly canGoPrevious = computed<boolean>(() => this.page() > 1);

  /** `true` s'il reste des demandes au-delà de la page courante (dérivé de `total`/`pageSize`). */
  protected readonly canGoNext = computed<boolean>(() => {
    const page = this.queueQuery.data();
    if (page === undefined) {
      return false;
    }
    return page.page * page.pageSize < page.total;
  });

  protected onStatusChange(change: MatButtonToggleChange): void {
    this.status.set(change.value as VerificationStatus);
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

  protected roleLabel(role: Role): string {
    return ROLE_LABELS[role];
  }
}
