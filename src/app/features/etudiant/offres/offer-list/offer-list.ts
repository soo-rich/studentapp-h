import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';

import { GENERIC_ERROR_MESSAGE } from '../../../../core/http/api-error';
import { injectPublicOffersQuery } from '../../data/public-offers.queries';
import { OpportunityType, PublicOfferListParams } from '../../data/public-offers.types';

/** Nombre d'offres par page — fixe, pas encore piloté par l'UI (cohérent avec `moderation/queue`). */
const PAGE_SIZE = 20;

/** Option affichée dans le filtre de type d'opportunité. `''` = pas de filtre (tous les types). */
interface OpportunityTypeFilterOption {
  readonly value: OpportunityType | '';
  readonly label: string;
}

const OPPORTUNITY_TYPE_FILTER_OPTIONS: readonly OpportunityTypeFilterOption[] = [
  { value: '', label: 'Tous les types' },
  { value: 'temps_partiel', label: 'Temps partiel' },
  { value: 'mission_ponctuelle', label: 'Mission ponctuelle' },
  { value: 'job_vacances', label: 'Job de vacances' },
  { value: 'stage', label: 'Stage' },
];

/** Libellés fr lisibles pour chaque `OpportunityType` du contrat (`public-offers.types.ts`). */
const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string> = {
  temps_partiel: 'Temps partiel',
  mission_ponctuelle: 'Mission ponctuelle',
  job_vacances: 'Job de vacances',
  stage: 'Stage',
};

/**
 * Parcours des offres publiées (Épic 3) : liste paginée (`GET /offers`) filtrable par type
 * d'opportunité, compétence et lieu, chaque ligne menant au détail (`/etudiant/offres/:offerId`).
 * Consomme exclusivement la couche data livrée en amont (`public-offers.queries.ts`) — aucun
 * `HttpClient`/`fetch` direct ici.
 *
 * Les filtres sont appliqués sur soumission du formulaire (bouton « Filtrer »), pas à chaque
 * frappe : aucune infrastructure de debounce n'existe encore dans ce projet, et une requête par
 * caractère saisi dans les champs texte (`skill`/`location`) serait un gaspillage réseau évitable.
 */
@Component({
  selector: 'app-offer-list',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './offer-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferList {
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly opportunityTypeFilterOptions = OPPORTUNITY_TYPE_FILTER_OPTIONS;

  protected readonly filterForm = this.formBuilder.group({
    opportunityType: this.formBuilder.control<OpportunityType | ''>(''),
    skill: this.formBuilder.control(''),
    location: this.formBuilder.control(''),
  });

  /** Filtres actuellement appliqués (dernière soumission du formulaire), `{}` = aucun filtre. */
  private readonly appliedFilters = signal<Omit<PublicOfferListParams, 'page' | 'pageSize'>>({});
  /** Page courante (1-indexée), remise à 1 à chaque changement de filtre. */
  protected readonly page = signal<number>(1);

  /**
   * Query TanStack `GET /offers` (couche data amont) — `params` réagit à `appliedFilters`/`page` :
   * tout changement de l'un ou l'autre régénère la query key et refetch.
   */
  protected readonly offersQuery = injectPublicOffersQuery(() => ({
    ...this.appliedFilters(),
    page: this.page(),
    pageSize: PAGE_SIZE,
  }));

  /**
   * Message d'erreur générique (`core/http/api-error`), `null` tant qu'aucune tentative n'a
   * échoué — pas de parsing du corps de l'erreur ici : un simple message générique suffit pour
   * cet écran de liste (même choix que `moderation/queue`).
   */
  protected readonly errorMessage = computed<string | null>(() =>
    this.offersQuery.error() === null ? null : GENERIC_ERROR_MESSAGE,
  );

  /** `true` si une page précédente existe (page courante > 1). */
  protected readonly canGoPrevious = computed<boolean>(() => this.page() > 1);

  /** `true` s'il reste des offres au-delà de la page courante (dérivé de `total`/`pageSize`). */
  protected readonly canGoNext = computed<boolean>(() => {
    const page = this.offersQuery.data();
    if (page === undefined) {
      return false;
    }
    return page.page * page.pageSize < page.total;
  });

  protected onApplyFilters(): void {
    const raw = this.filterForm.getRawValue();
    const skill = raw.skill.trim();
    const location = raw.location.trim();

    this.appliedFilters.set({
      opportunityType: raw.opportunityType === '' ? undefined : raw.opportunityType,
      skill: skill === '' ? undefined : skill,
      location: location === '' ? undefined : location,
    });
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

  protected opportunityTypeLabel(type: OpportunityType): string {
    return OPPORTUNITY_TYPE_LABELS[type];
  }
}
