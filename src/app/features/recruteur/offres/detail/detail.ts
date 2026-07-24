import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { extractErrorMessage } from '../../../../core/http/api-error';
import {
  injectCloseOfferMutation,
  injectOfferDetailQuery,
  injectPublishOfferMutation,
  injectUpdateOfferMutation,
} from '../../data/offers.queries';
import { OfferUpdateRequest, OpportunityType } from '../../data/offers.types';
import { OfferStatusBadge } from '../../ui/offer-status-badge/offer-status-badge';

/** Option affichée dans le select `opportunityType`. */
interface OpportunityTypeOption {
  readonly value: OpportunityType;
  readonly label: string;
}

/** Libellés fr lisibles pour chaque `OpportunityType` du contrat (`offers.types.ts`). */
const OPPORTUNITY_TYPE_OPTIONS: readonly OpportunityTypeOption[] = [
  { value: 'temps_partiel', label: 'Temps partiel' },
  { value: 'mission_ponctuelle', label: 'Mission ponctuelle' },
  { value: 'job_vacances', label: 'Job de vacances' },
  { value: 'stage', label: 'Stage' },
];

const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string> = {
  temps_partiel: 'Temps partiel',
  mission_ponctuelle: 'Mission ponctuelle',
  job_vacances: 'Job de vacances',
  stage: 'Stage',
};

/**
 * Détail d'une offre du recruteur courant (Épic 3) : `GET /recruiters/me/offers/{offerId}`,
 * édition en ligne (`PATCH`, uniquement tant que `draft`), publication (`POST .../publish`,
 * uniquement tant que `draft`) et fermeture (`POST .../close`, uniquement tant que
 * `published`) — chaque action est une mutation avec son propre état `isPending()`/erreur.
 * Lien vers la liste des candidats transmis. Consomme exclusivement la couche data livrée en
 * amont (`offers.queries.ts`) — aucun `HttpClient`/`fetch` direct ici.
 *
 * Route `/recruteur/offres/:offerId` (voir `recruteur.routes.ts`). Le router n'a pas
 * `withComponentInputBinding()` : `:offerId` est lu via `ActivatedRoute` converti en signal
 * (même pattern que `features/moderation/detail/detail.ts`).
 */
@Component({
  selector: 'app-recruteur-offre-detail',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    RouterLink,
    OfferStatusBadge,
  ],
  templateUrl: './detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OffreDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly opportunityTypeOptions = OPPORTUNITY_TYPE_OPTIONS;

  /** `:offerId` de la route courante, `null` tant que non résolu (ne devrait pas arriver). */
  protected readonly offerId = toSignal(
    this.route.paramMap.pipe(map((paramMap) => paramMap.get('offerId'))),
    { initialValue: null },
  );

  /** Query TanStack `GET /recruiters/me/offers/{offerId}` (couche data amont). */
  protected readonly detailQuery = injectOfferDetailQuery(this.offerId);
  /** Mutation TanStack `PATCH /recruiters/me/offers/{offerId}` (couche data amont). */
  protected readonly updateMutation = injectUpdateOfferMutation();
  /** Mutation TanStack `POST /recruiters/me/offers/{offerId}/publish` (couche data amont). */
  protected readonly publishMutation = injectPublishOfferMutation();
  /** Mutation TanStack `POST /recruiters/me/offers/{offerId}/close` (couche data amont). */
  protected readonly closeMutation = injectCloseOfferMutation();

  /** Message d'erreur traduit du chargement du détail, `null` si aucune ou en succès. */
  protected readonly detailErrorMessage = computed<string | null>(() => {
    const error = this.detailQuery.error();
    return error === null ? null : extractErrorMessage(error);
  });

  /** Message d'erreur traduit de la dernière publication tentée, `null` si aucune ou en succès. */
  protected readonly publishErrorMessage = computed<string | null>(() => {
    const error = this.publishMutation.error();
    return error === null ? null : extractErrorMessage(error);
  });

  /** Message d'erreur traduit de la dernière fermeture tentée, `null` si aucune ou en succès. */
  protected readonly closeErrorMessage = computed<string | null>(() => {
    const error = this.closeMutation.error();
    return error === null ? null : extractErrorMessage(error);
  });

  /** Message d'erreur traduit de la dernière édition tentée, `null` si aucune ou en succès. */
  protected readonly updateErrorMessage = computed<string | null>(() => {
    const error = this.updateMutation.error();
    return error === null ? null : extractErrorMessage(error);
  });

  /** `true` dès que le formulaire d'édition doit être affiché (offre en `draft` uniquement). */
  protected readonly showEditForm = signal(false);

  protected readonly editForm = this.formBuilder.group({
    title: this.formBuilder.control('', [Validators.required, Validators.maxLength(200)]),
    description: this.formBuilder.control('', [Validators.required, Validators.maxLength(5000)]),
    opportunityType: this.formBuilder.control<OpportunityType | ''>('', Validators.required),
    location: this.formBuilder.control('', [Validators.required, Validators.maxLength(200)]),
    durationLabel: this.formBuilder.control('', [
      Validators.required,
      Validators.maxLength(100),
    ]),
    compensationLabel: this.formBuilder.control('', [
      Validators.required,
      Validators.maxLength(200),
    ]),
  });

  protected onEdit(): void {
    const offer = this.detailQuery.data();
    if (offer === undefined) {
      return;
    }
    this.editForm.patchValue({
      title: offer.title,
      description: offer.description,
      opportunityType: offer.opportunityType,
      location: offer.location,
      durationLabel: offer.durationLabel,
      compensationLabel: offer.compensationLabel,
    });
    this.showEditForm.set(true);
  }

  protected onCancelEdit(): void {
    this.showEditForm.set(false);
  }

  private buildUpdatePayload(): OfferUpdateRequest {
    const raw = this.editForm.getRawValue();

    return {
      title: raw.title.trim(),
      description: raw.description.trim(),
      // `opportunityType` est validé requis avant l'appel de `buildUpdatePayload()` (voir
      // `onSubmitEdit()`) : au moment où ce payload est construit, la valeur ne peut plus être `''`.
      opportunityType: raw.opportunityType as OpportunityType,
      location: raw.location.trim(),
      durationLabel: raw.durationLabel.trim(),
      compensationLabel: raw.compensationLabel.trim(),
    };
  }

  protected onSubmitEdit(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const offerId = this.offerId();
    if (offerId === null) {
      return;
    }

    this.updateMutation.mutate(
      { offerId, body: this.buildUpdatePayload() },
      { onSuccess: () => this.showEditForm.set(false) },
    );
  }

  protected onPublish(): void {
    const offerId = this.offerId();
    if (offerId === null) {
      return;
    }
    this.publishMutation.mutate(offerId);
  }

  protected onClose(): void {
    const offerId = this.offerId();
    if (offerId === null) {
      return;
    }
    this.closeMutation.mutate(offerId);
  }

  protected onBack(): void {
    void this.router.navigate(['/recruteur', 'offres']);
  }

  protected opportunityTypeLabel(type: OpportunityType): string {
    return OPPORTUNITY_TYPE_LABELS[type];
  }

  /** Message de validation lisible pour un contrôle texte simple (requis / longueur max). */
  protected errorFor(control: FormControl<string>, label: string): string {
    if (control.hasError('required')) {
      return `${label} est requis.`;
    }
    const maxLengthError = control.getError('maxlength') as { requiredLength: number } | null;
    if (maxLengthError !== null) {
      return `${label} ne peut pas dépasser ${maxLengthError.requiredLength} caractères.`;
    }
    return '';
  }
}
