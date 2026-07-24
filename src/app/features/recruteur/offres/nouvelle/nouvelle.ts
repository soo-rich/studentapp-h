import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';

import { extractErrorCode, extractErrorMessage } from '../../../../core/http/api-error';
import { injectCreateOfferMutation } from '../../data/offers.queries';
import { OfferCreateRequest, OfferErrorCode, OpportunityType } from '../../data/offers.types';

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

/** Message dédié affiché lorsque le profil recruteur n'existe pas encore (422 `RECRUITER_PROFILE_REQUIRED`). */
const RECRUITER_PROFILE_REQUIRED_MESSAGE =
  "Complète d'abord ton profil recruteur avant de publier une offre.";

/**
 * Écran de création d'une offre (Épic 3) : `POST /recruiters/me/offers` (créée au statut
 * `draft`), navigue vers le détail de l'offre créée en cas de succès. Gère le cas 422
 * `RECRUITER_PROFILE_REQUIRED` avec un message dédié — voir CLAUDE.md ("complétez d'abord
 * votre profil recruteur"). Consomme exclusivement la couche data livrée en amont
 * (`offers.queries.ts`) — aucun `HttpClient`/`fetch` direct ici.
 *
 * Route `/recruteur/offres/nouvelle` (voir `recruteur.routes.ts`).
 */
@Component({
  selector: 'app-recruteur-nouvelle-offre',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    RouterLink,
  ],
  templateUrl: './nouvelle.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NouvelleOffre {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);

  /** Mutation TanStack `POST /recruiters/me/offers` — expose `mutate`, `isPending`, `error`. */
  protected readonly createMutation = injectCreateOfferMutation();

  protected readonly opportunityTypeOptions = OPPORTUNITY_TYPE_OPTIONS;

  /** `true` dès la première tentative d'envoi — déclenche l'affichage des erreurs de validation. */
  protected readonly submitAttempted = signal(false);

  protected readonly form = this.formBuilder.group({
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

  /**
   * Message d'erreur de la dernière tentative de création, `null` si aucune ou en succès. Cas
   * spécial `RECRUITER_PROFILE_REQUIRED` (422) : message dédié, actionnable, plutôt que le
   * message brut du backend.
   */
  protected readonly submitErrorMessage = computed<string | null>(() => {
    const error = this.createMutation.error();
    if (error === null) {
      return null;
    }
    if (extractErrorCode<OfferErrorCode>(error) === 'RECRUITER_PROFILE_REQUIRED') {
      return RECRUITER_PROFILE_REQUIRED_MESSAGE;
    }
    return extractErrorMessage(error);
  });

  /** `true` si l'échec courant est `RECRUITER_PROFILE_REQUIRED` — affiche un lien vers le profil. */
  protected readonly requiresRecruiterProfile = computed<boolean>(() => {
    const error = this.createMutation.error();
    return error !== null && extractErrorCode<OfferErrorCode>(error) === 'RECRUITER_PROFILE_REQUIRED';
  });

  private buildPayload(): OfferCreateRequest {
    const raw = this.form.getRawValue();

    return {
      title: raw.title.trim(),
      description: raw.description.trim(),
      // `opportunityType` est validé requis avant l'appel de `buildPayload()` (voir
      // `onSubmit()`) : au moment où ce payload est construit, la valeur ne peut plus être `''`.
      opportunityType: raw.opportunityType as OpportunityType,
      location: raw.location.trim(),
      durationLabel: raw.durationLabel.trim(),
      compensationLabel: raw.compensationLabel.trim(),
    };
  }

  protected onSubmit(): void {
    this.submitAttempted.set(true);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.createMutation.mutate(this.buildPayload(), {
      onSuccess: (offer) => void this.router.navigate(['/recruteur', 'offres', offer.id]),
    });
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
