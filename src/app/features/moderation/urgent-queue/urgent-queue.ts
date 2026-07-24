import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { Role } from '../../../core/auth/role';
import { GENERIC_ERROR_MESSAGE } from '../../../core/http/api-error';
import {
  injectReviewUrgentRequestMutation,
  injectUrgentQueueQuery,
} from '../data/moderation.queries';
import {
  ModerationErrorResponse,
  ModerationUrgentRequest,
  UrgentQueueParams,
  UrgentRequestReviewRequest,
  UrgentRequestStatus,
} from '../data/moderation.types';

/** Nombre de demandes par page — même valeur fixe que `moderation/queue` (voir brief T4). */
const PAGE_SIZE = 20;

/** Option affichée dans le filtre de statut. */
interface StatusFilterOption {
  readonly value: UrgentRequestStatus;
  readonly label: string;
}

/** Filtre de statut : `pending` en premier et sélectionné par défaut (voir brief T15). */
const STATUS_FILTER_OPTIONS: readonly StatusFilterOption[] = [
  { value: 'pending', label: 'En attente' },
  { value: 'prioritized', label: 'Priorisées' },
  { value: 'dismissed', label: 'Écartées' },
];

/** Libellés fr lisibles pour chaque `UrgentRequestStatus` du contrat (`moderation.types.ts`). */
const STATUS_LABELS: Record<UrgentRequestStatus, string> = {
  pending: 'En attente',
  prioritized: 'Priorisée',
  dismissed: 'Écartée',
};

/**
 * Classes Tailwind du badge de statut — mêmes tons neutres que `urgent-request-page.ts` (vue
 * étudiante) : pas de rouge pour `dismissed`, qui reste un aléa normal du traitement, pas un
 * échec. Registre sobre, voir brief T15 point 6 (ces messages relatent des situations de
 * détresse étudiante — l'écran est un outil de travail, pas une mise en scène).
 */
const STATUS_BADGE_CLASSES: Record<UrgentRequestStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  prioritized: 'bg-blue-50 text-blue-700',
  dismissed: 'bg-gray-100 text-gray-600',
};

/** Libellés fr lisibles pour chaque rôle (`components.schemas.Role` du contrat) — cf. `queue.ts`. */
const ROLE_LABELS: Record<Role, string> = {
  etudiant: 'Étudiant',
  recruteur: 'Recruteur',
  moderateur: 'Modérateur',
};

/**
 * Message dédié au 409 `URGENT_REQUEST_INVALID_STATE` (brief T15, point 4) : un autre
 * modérateur a traité la demande entre-temps. Ton factuel, pas de vocabulaire alarmiste — la
 * liste est actualisée automatiquement à la suite de cette erreur.
 */
const CONFLICT_MESSAGE =
  'Cette demande a déjà été traitée par un autre membre de la modération. La liste a été actualisée.';

/** Décision en cours de confirmation pour une demande donnée (panneau ouvert dans la liste). */
interface ActiveAction {
  readonly requestId: string;
  readonly decision: UrgentRequestReviewRequest['decision'];
}

/**
 * Corps attendu dans `HttpErrorResponse.error` sur un échec de `/moderation/urgent-requests*`
 * (contrat `studentapi`, `components.schemas.ErrorResponse`) — utilisé UNIQUEMENT pour
 * distinguer le code métier `URGENT_REQUEST_INVALID_STATE` (narrowing sûr, voir
 * `moderation.types.ts`), jamais pour construire un message affiché tel quel côté liste.
 */
function isModerationErrorResponse(value: unknown): value is ModerationErrorResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { error?: unknown }).error === 'string' &&
    typeof (value as { message?: unknown }).message === 'string'
  );
}

/** `true` si l'erreur de traitement est le 409 métier `URGENT_REQUEST_INVALID_STATE`. */
function isInvalidStateError(error: Error): boolean {
  return (
    error instanceof HttpErrorResponse &&
    isModerationErrorResponse(error.error) &&
    error.error.error === 'URGENT_REQUEST_INVALID_STATE'
  );
}

/**
 * File des demandes d'urgence (back-office modération, T15/Épic 2) : liste paginée
 * (`GET /moderation/urgent-requests`) filtrable par statut, avec traitement INLINE
 * (`POST /moderation/urgent-requests/{id}/review`) — pas d'écran de détail séparé, le contrat
 * n'exposant aucun `GET .../{id}` unitaire (voir décision d'architecture du brief T15).
 * Consomme exclusivement la couche data livrée en amont (`moderation.queries.ts`) — aucun
 * `HttpClient`/`fetch` direct ici.
 *
 * Registre volontairement sobre et factuel (brief T15, point 6) : ces demandes relatent des
 * situations de détresse étudiante, cet écran reste un outil de travail pour la modération.
 */
@Component({
  selector: 'app-urgent-queue',
  imports: [
    DatePipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
  ],
  templateUrl: './urgent-queue.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UrgentQueue {
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly statusFilterOptions = STATUS_FILTER_OPTIONS;

  /** Statut sélectionné dans le filtre — `pending` par défaut (brief T15). */
  protected readonly status = signal<UrgentRequestStatus>('pending');
  /** Page courante (1-indexée), remise à 1 à chaque changement de filtre. */
  protected readonly page = signal<number>(1);

  /**
   * Query TanStack `GET /moderation/urgent-requests` (couche data amont) — `params` réagit à
   * `status`/`page` : tout changement de l'un ou l'autre régénère la query key et refetch.
   */
  protected readonly queueQuery = injectUrgentQueueQuery(
    (): UrgentQueueParams => ({
      status: this.status(),
      page: this.page(),
      pageSize: PAGE_SIZE,
    }),
  );

  /** Mutation TanStack `POST /moderation/urgent-requests/{id}/review` (couche data amont). */
  protected readonly reviewMutation = injectReviewUrgentRequestMutation();

  /**
   * Message d'erreur générique (`core/http/api-error`) du chargement de la file, `null` tant
   * qu'aucune tentative n'a échoué — même choix que `moderation/queue` (pas de parsing du corps
   * de l'erreur pour un simple écran de liste).
   */
  protected readonly loadErrorMessage = computed<string | null>(() =>
    this.queueQuery.error() === null ? null : GENERIC_ERROR_MESSAGE,
  );

  /**
   * Message d'erreur de la dernière tentative de traitement, `null` si aucune ou en succès.
   * Cas particulier du 409 `URGENT_REQUEST_INVALID_STATE` (brief T15, point 4) : message dédié
   * `CONFLICT_MESSAGE`, jamais le corps brut du backend pour ce cas précis.
   */
  protected readonly actionErrorMessage = computed<string | null>(() => {
    const error = this.reviewMutation.error();
    if (error === null) {
      return null;
    }
    if (isInvalidStateError(error)) {
      return CONFLICT_MESSAGE;
    }
    return GENERIC_ERROR_MESSAGE;
  });

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

  /** Demande + décision dont le panneau de confirmation est actuellement ouvert, `null` sinon. */
  protected readonly activeAction = signal<ActiveAction | null>(null);

  /** Note interne optionnelle — contrainte backend `UrgentRequestReviewRequest.note` : max 500. */
  protected readonly noteForm = this.formBuilder.group({
    note: this.formBuilder.control('', [Validators.maxLength(500)]),
  });

  /** Titre du panneau de confirmation ouvert, vide tant qu'aucun n'est ouvert. */
  protected readonly actionFormTitle = computed<string>(() => {
    const action = this.activeAction();
    if (action === null) {
      return '';
    }
    return action.decision === 'prioritize'
      ? 'Classer cette demande en priorité'
      : 'Écarter cette demande';
  });

  /** Libellé du bouton de confirmation, reflète l'envoi en cours. */
  protected readonly confirmButtonLabel = computed<string>(() => {
    if (this.reviewMutation.isPending()) {
      return 'Envoi…';
    }
    return this.activeAction()?.decision === 'prioritize'
      ? 'Confirmer la priorité'
      : 'Confirmer le retrait';
  });

  protected onStatusChange(change: MatButtonToggleChange): void {
    this.status.set(change.value as UrgentRequestStatus);
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

  /** Ouvre le panneau de confirmation pour `request` avec la décision choisie. */
  protected onOpenAction(
    request: ModerationUrgentRequest,
    decision: UrgentRequestReviewRequest['decision'],
  ): void {
    this.activeAction.set({ requestId: request.id, decision });
    this.noteForm.reset({ note: '' });
  }

  protected onCancelAction(): void {
    this.activeAction.set(null);
    this.noteForm.reset({ note: '' });
  }

  /**
   * Envoie la décision de traitement — payload conforme au contrat : `{ decision }` seul si
   * aucune note n'a été saisie, `{ decision, note }` sinon (jamais de champ supplémentaire,
   * voir brief T15 — "Payload de traitement conforme").
   */
  protected onConfirmAction(): void {
    if (this.noteForm.invalid) {
      this.noteForm.markAllAsTouched();
      return;
    }

    const action = this.activeAction();
    if (action === null) {
      return;
    }

    const { note } = this.noteForm.getRawValue();
    const trimmedNote = note.trim();
    const body: UrgentRequestReviewRequest =
      trimmedNote.length > 0
        ? { decision: action.decision, note: trimmedNote }
        : { decision: action.decision };

    this.reviewMutation.mutate(
      { id: action.requestId, body },
      {
        onSuccess: () => {
          this.activeAction.set(null);
          this.noteForm.reset({ note: '' });
        },
        onError: (error) => {
          // Concurrence entre modérateurs (brief T15, point 4) : le panneau ouvert porte sur
          // une demande déjà traitée ailleurs — on le referme et on rafraîchit la liste pour
          // refléter son état réel, plutôt que de laisser l'utilisateur retenter une action
          // devenue invalide.
          if (isInvalidStateError(error)) {
            this.activeAction.set(null);
            this.noteForm.reset({ note: '' });
            void this.queueQuery.refetch();
          }
        },
      },
    );
  }

  /** `true` si le panneau de confirmation de `requestId` est actuellement ouvert. */
  protected isActionOpenFor(requestId: string): boolean {
    return this.activeAction()?.requestId === requestId;
  }

  protected statusLabel(status: UrgentRequestStatus): string {
    return STATUS_LABELS[status];
  }

  protected statusBadgeClasses(status: UrgentRequestStatus): string {
    return STATUS_BADGE_CLASSES[status];
  }

  protected roleLabel(role: Role): string {
    return ROLE_LABELS[role];
  }
}
