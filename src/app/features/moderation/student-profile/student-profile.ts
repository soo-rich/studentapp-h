import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { injectModerationStudentProfileQuery } from '../data/moderation.queries';
import {
  DayOfWeek,
  HousingSituation,
  ModerationErrorCode,
  OpportunityType,
} from '../data/moderation.types';

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
 * Corps attendu dans `HttpErrorResponse.error` sur un échec de
 * `/moderation/students/{userId}/profile` (contrat `studentapi`,
 * `components.schemas.ErrorResponse`). Redéfini localement, en LECTURE SEULE pour ce
 * composant — même pattern que `student-profile-form.ts`/`detail.ts` : `error` (code machine)
 * sert au `switch`/narrowing du 404 `PROFILE_NOT_FOUND`, `message` est uniquement affiché tel
 * quel, jamais parsé pour de la logique.
 */
interface ApiErrorBody {
  error?: string;
  message: string;
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { message?: unknown }).message === 'string'
  );
}

const GENERIC_ERROR_MESSAGE = 'Une erreur est survenue. Réessaie dans un instant.';

/** Extrait le message traduit d'une erreur HTTP, sans jamais parser son contenu. */
function extractErrorMessage(error: Error): string {
  if (error instanceof HttpErrorResponse && isApiErrorBody(error.error)) {
    return error.error.message;
  }
  return GENERIC_ERROR_MESSAGE;
}

/** Extrait le code machine (`ErrorResponse.error`) d'une erreur HTTP, `null` si absent/inattendu. */
function extractModerationErrorCode(error: Error): ModerationErrorCode | null {
  if (
    error instanceof HttpErrorResponse &&
    isApiErrorBody(error.error) &&
    typeof error.error.error === 'string'
  ) {
    return error.error.error as ModerationErrorCode;
  }
  return null;
}

/**
 * Profil complet d'un étudiant, vu par la modération (T17, Épic 2) :
 * `GET /moderation/students/{userId}/profile`, champs sensibles inclus mais explicitement
 * marqués comme des données restreintes, jamais transmises aux recruteurs (voir CLAUDE.md —
 * "le recruteur ne voit jamais les profils étudiants bruts" et section "Champs sensibles").
 * Consomme exclusivement la couche data livrée en T12 (`moderation.queries.ts`) — aucun
 * `HttpClient`/`fetch` direct ici.
 *
 * Route `/moderation/:userId/...` (câblage T18, hors périmètre de cette tâche). Le router n'a
 * pas `withComponentInputBinding()` : `:userId` est lu via `ActivatedRoute` converti en signal,
 * même pattern que `moderation/detail`.
 */
@Component({
  selector: 'app-moderation-student-profile',
  imports: [
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterLink,
  ],
  templateUrl: './student-profile.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModerationStudentProfile {
  private readonly route = inject(ActivatedRoute);

  /** `:userId` de la route courante, `null` tant que non résolu (ne devrait pas arriver). */
  protected readonly userId = toSignal(
    this.route.paramMap.pipe(map((paramMap) => paramMap.get('userId'))),
    { initialValue: null },
  );

  /** Query TanStack `GET /moderation/students/{userId}/profile` (couche data amont). */
  protected readonly profileQuery = injectModerationStudentProfileQuery(this.userId);

  private isProfileNotFoundError(error: Error): boolean {
    return extractModerationErrorCode(error) === 'PROFILE_NOT_FOUND';
  }

  /**
   * `true` si l'erreur de chargement est le 404 `PROFILE_NOT_FOUND` — cas NOMINAL (l'étudiant
   * n'a pas encore renseigné de profil détaillé), affiché avec un message neutre, jamais comme
   * une erreur technique (voir brief T17).
   */
  protected readonly isProfileNotFound = computed<boolean>(() => {
    const error = this.profileQuery.error();
    return error !== null && this.isProfileNotFoundError(error);
  });

  /** Message d'erreur traduit du chargement, `null` en succès OU sur le 404 nominal. */
  protected readonly profileLoadErrorMessage = computed<string | null>(() => {
    const error = this.profileQuery.error();
    if (error === null || this.isProfileNotFoundError(error)) {
      return null;
    }
    return extractErrorMessage(error);
  });

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
