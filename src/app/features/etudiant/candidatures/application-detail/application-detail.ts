import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { extractErrorMessage } from '../../../../core/http/api-error';
import {
  injectAcceptApplicationMutation,
  injectDeclineApplicationMutation,
  injectStudentApplicationDetailQuery,
  injectWithdrawApplicationMutation,
} from '../../data/applications.queries';
import { ApplicationStatus } from '../../data/applications.types';

/** Libellés fr lisibles pour chaque `ApplicationStatus` du contrat — cf. `application-list.ts`. */
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

/** Classes Tailwind du badge de statut — cf. `application-list.ts`. */
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
 * Statuts TERMINAUX d'une candidature (contrat `docs/openapi.yaml`, description de
 * `DELETE /students/me/applications/{applicationId}`) : le retrait n'est plus possible une fois
 * l'un de ces statuts atteint (409 `APPLICATION_NOT_WITHDRAWABLE` sinon).
 */
const TERMINAL_STATUSES: readonly ApplicationStatus[] = [
  'rejected_moderation',
  'rejected_by_recruiter',
  'accepted',
  'declined',
  'withdrawn',
];

/**
 * Détail d'une candidature de l'étudiant courant (Épic 3) : identité de l'offre, statut, motif
 * de refus le cas échéant, et actions conditionnelles — accepter/refuser la mise en relation
 * (`selected` → `accepted`/`declined`) et retirer la candidature (`DELETE`, avec confirmation
 * in-page, tant que le statut n'est pas terminal). Consomme exclusivement la couche data livrée
 * en amont (`applications.queries.ts`) — aucun `HttpClient`/`fetch` direct ici.
 *
 * Route `/etudiant/candidatures/:applicationId` (câblage par l'orchestrateur via
 * `etudiant.routes.ts`). Le router n'a pas `withComponentInputBinding()` : `:applicationId` est
 * lu via `ActivatedRoute` converti en signal, même pattern que `moderation/detail`.
 */
@Component({
  selector: 'app-application-detail',
  imports: [DatePipe, MatButtonModule, MatCardModule, MatProgressSpinnerModule, RouterLink],
  templateUrl: './application-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** `:applicationId` de la route courante, `null` tant que non résolu (ne devrait pas arriver). */
  protected readonly applicationId = toSignal(
    this.route.paramMap.pipe(map((paramMap) => paramMap.get('applicationId'))),
    { initialValue: null },
  );

  /** Query TanStack `GET /students/me/applications/{applicationId}` (couche data amont). */
  protected readonly detailQuery = injectStudentApplicationDetailQuery(this.applicationId);
  /** Mutation TanStack `POST .../accept` (couche data amont). */
  protected readonly acceptMutation = injectAcceptApplicationMutation();
  /** Mutation TanStack `POST .../decline` (couche data amont). */
  protected readonly declineMutation = injectDeclineApplicationMutation();
  /** Mutation TanStack `DELETE .../{applicationId}` (couche data amont). */
  protected readonly withdrawMutation = injectWithdrawApplicationMutation();

  /** Message d'erreur traduit du chargement du détail, `null` si aucune ou en succès. */
  protected readonly detailErrorMessage = computed<string | null>(() => {
    const error = this.detailQuery.error();
    return error === null ? null : extractErrorMessage(error);
  });

  /** Message d'erreur traduit de la dernière tentative d'acceptation, `null` si aucune ou en succès. */
  protected readonly acceptErrorMessage = computed<string | null>(() => {
    const error = this.acceptMutation.error();
    return error === null ? null : extractErrorMessage(error);
  });

  /** Message d'erreur traduit de la dernière tentative de refus, `null` si aucune ou en succès. */
  protected readonly declineErrorMessage = computed<string | null>(() => {
    const error = this.declineMutation.error();
    return error === null ? null : extractErrorMessage(error);
  });

  /** Message d'erreur traduit de la dernière tentative de retrait, `null` si aucune ou en succès. */
  protected readonly withdrawErrorMessage = computed<string | null>(() => {
    const error = this.withdrawMutation.error();
    return error === null ? null : extractErrorMessage(error);
  });

  /** `true` si la candidature est `selected` — actions accepter/refuser la mise en relation possibles. */
  protected readonly canRespondToSelection = computed<boolean>(() => {
    const application = this.detailQuery.data();
    return application !== undefined && application.status === 'selected';
  });

  /** `true` si la candidature n'est pas dans un statut terminal — le retrait reste possible. */
  protected readonly canWithdraw = computed<boolean>(() => {
    const application = this.detailQuery.data();
    return application !== undefined && !TERMINAL_STATUSES.includes(application.status);
  });

  /** `true` dès que le panneau de confirmation de retrait doit être affiché. */
  protected readonly showWithdrawConfirm = signal(false);

  protected onAccept(): void {
    const applicationId = this.applicationId();
    if (applicationId === null) {
      return;
    }
    this.acceptMutation.mutate(applicationId);
  }

  protected onDecline(): void {
    const applicationId = this.applicationId();
    if (applicationId === null) {
      return;
    }
    this.declineMutation.mutate(applicationId);
  }

  protected onShowWithdrawConfirm(): void {
    this.showWithdrawConfirm.set(true);
  }

  protected onCancelWithdraw(): void {
    this.showWithdrawConfirm.set(false);
  }

  protected onConfirmWithdraw(): void {
    const applicationId = this.applicationId();
    if (applicationId === null) {
      return;
    }

    this.withdrawMutation.mutate(applicationId, {
      onSuccess: () => void this.router.navigate(['/etudiant/candidatures']),
    });
  }

  protected statusLabel(status: ApplicationStatus): string {
    return STATUS_LABELS[status];
  }

  protected statusBadgeClasses(status: ApplicationStatus): string {
    return STATUS_BADGE_CLASSES[status];
  }
}
