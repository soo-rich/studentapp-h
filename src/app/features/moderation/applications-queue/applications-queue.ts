import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';

import { GENERIC_ERROR_MESSAGE } from '../../../core/http/api-error';
import { injectModerationApplicationsQueueQuery } from '../data/moderation-applications.queries';
import { ApplicationStatus } from '../data/moderation-applications.types';

/** Nombre de candidatures par page — même valeur fixe que la file de vérification (`queue.ts`). */
const PAGE_SIZE = 20;

/** Option affichée dans le filtre de statut. */
interface StatusFilterOption {
  readonly value: ApplicationStatus;
  readonly label: string;
}

/**
 * Options du filtre de statut : uniquement les 3 transitions PILOTÉES par la modération
 * (`pending_moderation` → `forwarded` | `rejected_moderation`). Les 5 autres valeurs
 * d'`ApplicationStatus` (`selected`, `accepted`, `declined`, `rejected_by_recruiter`,
 * `withdrawn`) restent des valeurs valides du filtre côté contrat mais sont pilotées par le
 * recruteur/l'étudiant après transmission — hors du périmètre d'action de cet écran.
 */
const STATUS_FILTER_OPTIONS: readonly StatusFilterOption[] = [
  { value: 'pending_moderation', label: 'En attente' },
  { value: 'forwarded', label: 'Transmises' },
  { value: 'rejected_moderation', label: 'Rejetées' },
];

/** Libellés fr lisibles pour chaque valeur d'`ApplicationStatus` du contrat. */
const STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending_moderation: 'En attente de modération',
  forwarded: 'Transmise au recruteur',
  rejected_moderation: 'Rejetée en modération',
  selected: 'Sélectionnée par le recruteur',
  accepted: "Acceptée par l'étudiant",
  declined: "Refusée par l'étudiant",
  rejected_by_recruiter: 'Écartée par le recruteur',
  withdrawn: "Retirée par l'étudiant",
};

/** Classes Tailwind du badge de statut — l'état n'est jamais porté par la seule couleur (texte accolé). */
const STATUS_TONE_CLASSES: Record<ApplicationStatus, string> = {
  pending_moderation: 'bg-gray-100 text-gray-700',
  forwarded: 'bg-blue-100 text-blue-800',
  rejected_moderation: 'bg-red-100 text-red-800',
  selected: 'bg-indigo-100 text-indigo-800',
  accepted: 'bg-green-100 text-green-800',
  declined: 'bg-amber-100 text-amber-800',
  rejected_by_recruiter: 'bg-red-100 text-red-800',
  withdrawn: 'bg-gray-100 text-gray-700',
};

/**
 * File des candidatures (back-office modération, Épic 3) : liste paginée
 * (`GET /moderation/applications`) filtrable par statut, chaque ligne menant au détail
 * (`/moderation/candidatures/:applicationId`). Calque `features/moderation/queue/` (Épic 1) —
 * fichier NEUF et séparé, ne modifie pas cette file de vérification existante. Consomme
 * exclusivement la couche data livrée en amont (`moderation-applications.queries.ts`) — aucun
 * `HttpClient`/`fetch` direct ici.
 *
 * Route prévue `/moderation/candidatures` (voir `moderation-applications.routes.ts` — câblage
 * dans `app.routes.ts` hors périmètre de cette tâche, réservé à l'orchestrateur).
 */
@Component({
  selector: 'app-moderation-applications-queue',
  imports: [
    DatePipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
    RouterLink,
  ],
  templateUrl: './applications-queue.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModerationApplicationsQueue {
  protected readonly statusFilterOptions = STATUS_FILTER_OPTIONS;

  /** Statut sélectionné dans le filtre — `pending_moderation` par défaut (même défaut serveur). */
  protected readonly status = signal<ApplicationStatus>('pending_moderation');
  /** Page courante (1-indexée), remise à 1 à chaque changement de filtre. */
  protected readonly page = signal<number>(1);

  /**
   * Query TanStack `GET /moderation/applications` (couche data amont) — `params` réagit à
   * `status`/`page` : tout changement de l'un ou l'autre régénère la query key et refetch.
   */
  protected readonly queueQuery = injectModerationApplicationsQueueQuery(() => ({
    status: this.status(),
    page: this.page(),
    pageSize: PAGE_SIZE,
  }));

  /**
   * Message d'erreur générique (`core/http/api-error`), `null` tant qu'aucune tentative n'a
   * échoué — même choix que la file de vérification (`queue.ts`) : un message générique
   * suffit pour cet écran de liste.
   */
  protected readonly errorMessage = computed<string | null>(() =>
    this.queueQuery.error() === null ? null : GENERIC_ERROR_MESSAGE,
  );

  /** `true` si une page précédente existe (page courante > 1). */
  protected readonly canGoPrevious = computed<boolean>(() => this.page() > 1);

  /** `true` s'il reste des candidatures au-delà de la page courante (dérivé de `total`/`pageSize`). */
  protected readonly canGoNext = computed<boolean>(() => {
    const page = this.queueQuery.data();
    if (page === undefined) {
      return false;
    }
    return page.page * page.pageSize < page.total;
  });

  protected onStatusChange(change: MatButtonToggleChange): void {
    this.status.set(change.value as ApplicationStatus);
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

  protected statusToneClasses(status: ApplicationStatus): string {
    return STATUS_TONE_CLASSES[status];
  }
}
