import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { extractErrorMessage } from '../../../core/http/api-error';
import {
  injectApproveModerationApplicationMutation,
  injectModerationApplicationDetailQuery,
  injectRejectModerationApplicationMutation,
} from '../data/moderation-applications.queries';
import {
  ApplicationStatus,
  DayOfWeek,
  HousingSituation,
  OpportunityType,
} from '../data/moderation-applications.types';

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

/** Libellés fr lisibles pour chaque `DayOfWeek` du contrat (créneaux de disponibilité). */
const DAY_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  lundi: 'Lundi',
  mardi: 'Mardi',
  mercredi: 'Mercredi',
  jeudi: 'Jeudi',
  vendredi: 'Vendredi',
  samedi: 'Samedi',
  dimanche: 'Dimanche',
};

/** Libellés fr lisibles pour chaque `OpportunityType` du contrat. */
const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string> = {
  temps_partiel: 'Temps partiel',
  mission_ponctuelle: 'Mission ponctuelle',
  job_vacances: 'Job de vacances',
  stage: 'Stage',
};

/**
 * Libellés fr lisibles pour chaque `HousingSituation` du contrat. Champ SENSIBLE — voir
 * section « Informations sensibles » du template.
 */
const HOUSING_SITUATION_LABELS: Record<HousingSituation, string> = {
  seul: 'Vit seul(e)',
  avec_parents_tuteurs: 'Vit avec parents ou tuteurs',
};

/**
 * Détail d'une candidature (back-office modération, Épic 3) : offre visée, profil COMPLET de
 * l'étudiant (champs sensibles inclus — vue modération légitime, voir CLAUDE.md), message de
 * motivation, et actions approuver/rejeter
 * (`POST /moderation/applications/{applicationId}/approve|reject`). Calque
 * `features/moderation/detail/` (Épic 1) — fichier NEUF et séparé, ne modifie pas cet écran de
 * détail de vérification existant. Consomme exclusivement la couche data livrée en amont
 * (`moderation-applications.queries.ts`) — aucun `HttpClient`/`fetch` direct ici.
 *
 * Route prévue `/moderation/candidatures/:applicationId` (voir
 * `moderation-applications.routes.ts` — câblage dans `app.routes.ts` hors périmètre de cette
 * tâche, réservé à l'orchestrateur). Le router n'a pas `withComponentInputBinding()` :
 * `:applicationId` est lu via `ActivatedRoute` converti en signal, même pattern que
 * `moderation/detail`.
 */
@Component({
  selector: 'app-moderation-applications-detail',
  imports: [
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
  ],
  templateUrl: './applications-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModerationApplicationsDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  /** `:applicationId` de la route courante, `null` tant que non résolu (ne devrait pas arriver). */
  protected readonly applicationId = toSignal(
    this.route.paramMap.pipe(map((paramMap) => paramMap.get('applicationId'))),
    { initialValue: null },
  );

  /** Query TanStack `GET /moderation/applications/{applicationId}` (couche data amont). */
  protected readonly detailQuery = injectModerationApplicationDetailQuery(this.applicationId);
  /** Mutation TanStack `POST /moderation/applications/{applicationId}/approve` (couche data amont). */
  protected readonly approveMutation = injectApproveModerationApplicationMutation();
  /** Mutation TanStack `POST /moderation/applications/{applicationId}/reject` (couche data amont). */
  protected readonly rejectMutation = injectRejectModerationApplicationMutation();

  /** Message d'erreur traduit du chargement du détail, `null` si aucune ou en succès. */
  protected readonly detailErrorMessage = computed<string | null>(() => {
    const error = this.detailQuery.error();
    return error === null ? null : extractErrorMessage(error);
  });

  /** Message d'erreur traduit de la dernière tentative d'approbation, `null` si aucune ou en succès. */
  protected readonly approveErrorMessage = computed<string | null>(() => {
    const error = this.approveMutation.error();
    return error === null ? null : extractErrorMessage(error);
  });

  /** Message d'erreur traduit de la dernière tentative de rejet, `null` si aucune ou en succès. */
  protected readonly rejectErrorMessage = computed<string | null>(() => {
    const error = this.rejectMutation.error();
    return error === null ? null : extractErrorMessage(error);
  });

  /**
   * `true` si la candidature peut encore être approuvée/rejetée — uniquement lorsque son
   * statut vaut `pending_moderation` (déjà traitée sinon).
   */
  protected readonly isActionable = computed<boolean>(() => {
    const application = this.detailQuery.data();
    return application !== undefined && application.status === 'pending_moderation';
  });

  /** `true` dès que le champ motif de rejet doit être affiché. */
  protected readonly showRejectForm = signal(false);

  /** Motif de rejet — contrainte backend `ApplicationRejectRequest.reason` : 3 à 500 caractères. */
  protected readonly rejectForm = this.formBuilder.group({
    reason: this.formBuilder.control('', [
      Validators.required,
      Validators.minLength(3),
      Validators.maxLength(500),
    ]),
  });

  protected onApprove(): void {
    const applicationId = this.applicationId();
    if (applicationId === null) {
      return;
    }

    this.approveMutation.mutate(applicationId, {
      onSuccess: () => void this.router.navigate(['/moderation', 'candidatures']),
    });
  }

  protected onShowRejectForm(): void {
    this.showRejectForm.set(true);
  }

  protected onCancelReject(): void {
    this.showRejectForm.set(false);
    this.rejectForm.reset({ reason: '' });
  }

  protected onSubmitReject(): void {
    if (this.rejectForm.invalid) {
      this.rejectForm.markAllAsTouched();
      return;
    }

    const applicationId = this.applicationId();
    if (applicationId === null) {
      return;
    }

    const { reason } = this.rejectForm.getRawValue();
    this.rejectMutation.mutate(
      { applicationId, reason },
      { onSuccess: () => void this.router.navigate(['/moderation', 'candidatures']) },
    );
  }

  protected onBack(): void {
    void this.router.navigate(['/moderation', 'candidatures']);
  }

  protected statusLabel(status: ApplicationStatus): string {
    return STATUS_LABELS[status];
  }

  protected statusToneClasses(status: ApplicationStatus): string {
    return STATUS_TONE_CLASSES[status];
  }

  protected dayOfWeekLabel(day: DayOfWeek): string {
    return DAY_OF_WEEK_LABELS[day];
  }

  protected opportunityTypeLabel(type: OpportunityType): string {
    return OPPORTUNITY_TYPE_LABELS[type];
  }

  /** Libellé fr de `housingSituation` (SENSIBLE), `« Non précisé »` si absent. */
  protected housingSituationLabel(situation: HousingSituation | null | undefined): string {
    if (situation === null || situation === undefined) {
      return 'Non précisé';
    }
    return HOUSING_SITUATION_LABELS[situation];
  }
}
