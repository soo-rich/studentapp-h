import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { extractErrorMessage, GENERIC_ERROR_MESSAGE } from '../../../../core/http/api-error';
import {
  injectCandidateContactQuery,
  injectCandidatesQuery,
  injectSelectCandidateMutation,
} from '../../data/candidates.queries';
import { CandidateVisibleStatus, OpportunityType } from '../../data/candidates.types';
import { CandidateStatusBadge } from '../../ui/candidate-status-badge/candidate-status-badge';

/** Nombre de candidats par page — cohérent avec le défaut backend (`pageSize = 20`). */
const PAGE_SIZE = 20;

/** Valeur du filtre de statut représentant « tous les candidats visibles » (pas de filtre envoyé). */
type StatusFilterValue = CandidateVisibleStatus | 'all';

/** Option affichée dans le filtre de statut. */
interface StatusFilterOption {
  readonly value: StatusFilterValue;
  readonly label: string;
}

const STATUS_FILTER_OPTIONS: readonly StatusFilterOption[] = [
  { value: 'all', label: 'Tous' },
  { value: 'forwarded', label: 'Transmis' },
  { value: 'selected', label: 'Sélectionnés' },
  { value: 'accepted', label: 'Acceptés' },
  { value: 'declined', label: 'Refusés' },
  { value: 'rejected_by_recruiter', label: 'Écartés' },
];

/** Libellés fr lisibles pour chaque `OpportunityType` du contrat (`candidates.types.ts`). */
const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string> = {
  temps_partiel: 'Temps partiel',
  mission_ponctuelle: 'Mission ponctuelle',
  job_vacances: 'Job de vacances',
  stage: 'Stage',
};

const DAY_OF_WEEK_LABELS: Record<string, string> = {
  lundi: 'Lun.',
  mardi: 'Mar.',
  mercredi: 'Mer.',
  jeudi: 'Jeu.',
  vendredi: 'Ven.',
  samedi: 'Sam.',
  dimanche: 'Dim.',
};

/**
 * Liste des fiches candidats ANONYMES d'une offre (Épic 3) :
 * `GET /recruiters/me/offers/{offerId}/candidates`, filtrable par statut, paginée. N'affiche
 * QUE les champs de `CandidateCard` (voir CLAUDE.md — "le recruteur ne voit jamais les
 * profils étudiants bruts") : jamais de nom/contact. Action « sélectionner » (statut
 * `forwarded`) et « voir les coordonnées » (statut `accepted`, déclenche
 * `GET .../contact`). Consomme exclusivement la couche data livrée en amont
 * (`candidates.queries.ts`) — aucun `HttpClient`/`fetch` direct ici.
 *
 * Route `/recruteur/offres/:offerId/candidats` (voir `recruteur.routes.ts`). Le router n'a
 * pas `withComponentInputBinding()` : `:offerId` est lu via `ActivatedRoute` converti en
 * signal (même pattern que `features/moderation/detail/detail.ts`).
 */
@Component({
  selector: 'app-recruteur-offre-candidats',
  imports: [
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatProgressSpinnerModule,
    CandidateStatusBadge,
  ],
  templateUrl: './candidats.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OffreCandidats {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly statusFilterOptions = STATUS_FILTER_OPTIONS;

  /** `:offerId` de la route courante, `null` tant que non résolu (ne devrait pas arriver). */
  protected readonly offerId = toSignal(
    this.route.paramMap.pipe(map((paramMap) => paramMap.get('offerId'))),
    { initialValue: null },
  );

  /** Statut sélectionné dans le filtre — « tous » par défaut. */
  protected readonly status = signal<StatusFilterValue>('all');
  /** Page courante (1-indexée), remise à 1 à chaque changement de filtre. */
  protected readonly page = signal<number>(1);

  /** Query TanStack `GET .../candidates` (couche data amont) — réagit à `offerId`/`status`/`page`. */
  protected readonly candidatesQuery = injectCandidatesQuery(this.offerId, () => {
    const status = this.status();
    return {
      status: status === 'all' ? undefined : status,
      page: this.page(),
      pageSize: PAGE_SIZE,
    };
  });

  /** Mutation TanStack `POST .../select` (couche data amont). */
  protected readonly selectMutation = injectSelectCandidateMutation();

  /**
   * Identifiant de la candidature dont les coordonnées sont demandées, `null` si aucune —
   * pilote `injectCandidateContactQuery` (déclenchée seulement au clic sur « voir les
   * coordonnées », jamais automatiquement).
   */
  protected readonly contactRequestedFor = signal<string | null>(null);
  /** Query TanStack `GET .../contact` (couche data amont), désactivée tant qu'aucune demande. */
  protected readonly contactQuery = injectCandidateContactQuery(
    this.offerId,
    this.contactRequestedFor,
  );

  /** Message d'erreur générique (`core/http/api-error`), `null` tant qu'aucune tentative n'a échoué. */
  protected readonly errorMessage = computed<string | null>(() =>
    this.candidatesQuery.error() === null ? null : GENERIC_ERROR_MESSAGE,
  );

  /** Message d'erreur traduit de la dernière sélection tentée, `null` si aucune ou en succès. */
  protected readonly selectErrorMessage = computed<string | null>(() => {
    const error = this.selectMutation.error();
    return error === null ? null : extractErrorMessage(error);
  });

  /** Message d'erreur traduit de la dernière demande de coordonnées, `null` si aucune ou en succès. */
  protected readonly contactErrorMessage = computed<string | null>(() => {
    const error = this.contactQuery.error();
    return error === null ? null : extractErrorMessage(error);
  });

  /** `true` si une page précédente existe (page courante > 1). */
  protected readonly canGoPrevious = computed<boolean>(() => this.page() > 1);

  /** `true` s'il reste des candidats au-delà de la page courante (dérivé de `total`/`pageSize`). */
  protected readonly canGoNext = computed<boolean>(() => {
    const page = this.candidatesQuery.data();
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

  protected onSelect(applicationId: string): void {
    const offerId = this.offerId();
    if (offerId === null) {
      return;
    }
    this.selectMutation.mutate({ offerId, applicationId });
  }

  protected onRequestContact(applicationId: string): void {
    this.contactRequestedFor.set(applicationId);
  }

  protected isContactRequested(applicationId: string): boolean {
    return this.contactRequestedFor() === applicationId;
  }

  protected onBack(): void {
    const offerId = this.offerId();
    void this.router.navigate(offerId === null ? ['/recruteur', 'offres'] : ['/recruteur', 'offres', offerId]);
  }

  protected opportunityTypeLabel(type: OpportunityType): string {
    return OPPORTUNITY_TYPE_LABELS[type];
  }

  protected dayOfWeekLabel(day: string): string {
    return DAY_OF_WEEK_LABELS[day] ?? day;
  }
}
