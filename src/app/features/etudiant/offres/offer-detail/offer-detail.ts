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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { extractErrorCode, extractErrorMessage } from '../../../../core/http/api-error';
import { injectApplyMutation } from '../../data/applications.queries';
import { ApplicationErrorCode } from '../../data/applications.types';
import { injectPublicOfferDetailQuery } from '../../data/public-offers.queries';
import { DayOfWeek, OpportunityType, RecruiterStructureType } from '../../data/public-offers.types';

/** Libellés fr lisibles pour chaque `OpportunityType` du contrat (`public-offers.types.ts`). */
const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string> = {
  temps_partiel: 'Temps partiel',
  mission_ponctuelle: 'Mission ponctuelle',
  job_vacances: 'Job de vacances',
  stage: 'Stage',
};

/** Libellés fr lisibles pour chaque `RecruiterStructureType` du contrat. */
const STRUCTURE_TYPE_LABELS: Record<RecruiterStructureType, string> = {
  entreprise: 'Entreprise',
  commerce: 'Commerce',
  agence: 'Agence',
  hotel: 'Hôtel',
  restaurant: 'Restaurant',
  ong: 'ONG',
  particulier: 'Particulier',
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

/**
 * Détail d'une offre publiée (Épic 3) : informations de l'offre, du recruteur (`PublicRecruiter`)
 * et dépôt de candidature (`POST /offers/{offerId}/applications`) avec message de motivation
 * optionnel. Consomme exclusivement la couche data livrée en amont (`public-offers.queries.ts`,
 * `applications.queries.ts`) — aucun `HttpClient`/`fetch` direct ici.
 *
 * Route `/etudiant/offres/:offerId` (câblage par l'orchestrateur via `etudiant.routes.ts`). Le
 * router n'a pas `withComponentInputBinding()` : `:offerId` est lu via `ActivatedRoute` converti
 * en signal, même pattern que `moderation/detail`.
 *
 * Erreurs de candidature dédiées (brief) : 409 `APPLICATION_ALREADY_EXISTS`, 422
 * `OFFER_NOT_OPEN`, 422 `PROFILE_REQUIRED` (avec lien vers `/etudiant/profil`) — tout autre code
 * retombe sur le message traduit renvoyé par le backend (`extractErrorMessage`).
 */
@Component({
  selector: 'app-offer-detail',
  imports: [
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './offer-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  /** `:offerId` de la route courante, `null` tant que non résolu (ne devrait pas arriver). */
  protected readonly offerId = toSignal(
    this.route.paramMap.pipe(map((paramMap) => paramMap.get('offerId'))),
    { initialValue: null },
  );

  /** Query TanStack `GET /offers/{offerId}` (couche data amont). */
  protected readonly offerQuery = injectPublicOfferDetailQuery(this.offerId);
  /** Mutation TanStack `POST /offers/{offerId}/applications` (couche data amont). */
  protected readonly applyMutation = injectApplyMutation();

  /** Message d'erreur traduit du chargement de l'offre, `null` si aucune ou en succès. */
  protected readonly offerErrorMessage = computed<string | null>(() => {
    const error = this.offerQuery.error();
    return error === null ? null : extractErrorMessage(error);
  });

  /** `true` dès que le formulaire de candidature (message optionnel) doit être affiché. */
  protected readonly showApplyForm = signal(false);

  /** Message de motivation — contrainte backend `ApplicationCreateRequest.message` : max 1000. */
  protected readonly applyForm = this.formBuilder.group({
    message: this.formBuilder.control('', Validators.maxLength(1000)),
  });

  /** Code machine de la dernière erreur de candidature, `null` si aucune ou en succès. */
  private readonly applyErrorCode = computed<ApplicationErrorCode | null>(() => {
    const error = this.applyMutation.error();
    return error === null ? null : extractErrorCode<ApplicationErrorCode>(error);
  });

  /**
   * Message d'erreur de la dernière tentative de candidature, `null` si aucune ou en succès.
   * Cas spéciaux (brief) : `APPLICATION_ALREADY_EXISTS` (409), `OFFER_NOT_OPEN` (422),
   * `PROFILE_REQUIRED` (422) — message dédié plutôt que le corps brut du backend. Tout autre
   * code retombe sur le message traduit renvoyé par l'API.
   */
  protected readonly applyErrorMessage = computed<string | null>(() => {
    const error = this.applyMutation.error();
    if (error === null) {
      return null;
    }
    switch (this.applyErrorCode()) {
      case 'APPLICATION_ALREADY_EXISTS':
        return 'Tu as déjà candidaté à cette offre.';
      case 'OFFER_NOT_OPEN':
        return "Cette offre n'est plus ouverte aux candidatures.";
      case 'PROFILE_REQUIRED':
        return 'Complète ton profil étudiant avant de pouvoir postuler.';
      default:
        return extractErrorMessage(error);
    }
  });

  /** `true` si la dernière erreur de candidature est `PROFILE_REQUIRED` — affiche un lien dédié. */
  protected readonly profileRequired = computed<boolean>(
    () => this.applyErrorCode() === 'PROFILE_REQUIRED',
  );

  protected onShowApplyForm(): void {
    this.showApplyForm.set(true);
  }

  protected onCancelApply(): void {
    this.showApplyForm.set(false);
    this.applyForm.reset({ message: '' });
  }

  protected onSubmitApply(): void {
    if (this.applyForm.invalid) {
      this.applyForm.markAllAsTouched();
      return;
    }

    const offerId = this.offerId();
    if (offerId === null) {
      return;
    }

    const { message } = this.applyForm.getRawValue();
    const trimmedMessage = message.trim();

    this.applyMutation.mutate({
      offerId,
      body: { message: trimmedMessage === '' ? null : trimmedMessage },
    });
  }

  protected opportunityTypeLabel(type: OpportunityType): string {
    return OPPORTUNITY_TYPE_LABELS[type];
  }

  protected structureTypeLabel(type: RecruiterStructureType): string {
    return STRUCTURE_TYPE_LABELS[type];
  }

  protected dayOfWeekLabel(day: DayOfWeek): string {
    return DAY_OF_WEEK_LABELS[day];
  }
}
