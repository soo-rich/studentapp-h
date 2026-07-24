import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import {
  injectCreateUrgentRequestMutation,
  injectUrgentRequestQuery,
} from '../../data/urgent-request.queries';
import {
  UrgentRequest,
  UrgentRequestErrorResponse,
  UrgentRequestStatus,
} from '../../data/urgent-request.types';

/** Libellés fr lisibles pour chaque `UrgentRequestStatus` du contrat (`urgent-request.types.ts`). */
const STATUS_LABELS: Record<UrgentRequestStatus, string> = {
  pending: "En attente d'examen",
  prioritized: 'Classée prioritaire',
  dismissed: 'Demande écartée',
};

/**
 * Classes Tailwind du badge de statut, par statut — ton neutre, non alarmiste (pas de rouge
 * pour `dismissed`, qui reste un aléa normal du traitement, pas un échec de l'étudiant).
 */
const STATUS_BADGE_CLASSES: Record<UrgentRequestStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  prioritized: 'bg-blue-50 text-blue-700',
  dismissed: 'bg-gray-100 text-gray-600',
};

/**
 * Corps attendu dans `HttpErrorResponse.error` sur un échec de `/students/me/urgent-request`
 * (contrat `studentapi`, `components.schemas.ErrorResponse`) — réutilise le type déjà exporté
 * par la couche data (`UrgentRequestErrorResponse`, `urgent-request.types.ts`) plutôt que de le
 * redéfinir localement. Jamais parsé pour de la logique : uniquement affiché tel quel, déjà
 * traduit fr/en par le backend.
 */
function isUrgentRequestErrorResponse(value: unknown): value is UrgentRequestErrorResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { message?: unknown }).message === 'string'
  );
}

const GENERIC_ERROR_MESSAGE = 'Une erreur est survenue. Réessaie dans un instant.';

/** Extrait le message traduit d'une erreur HTTP, sans jamais parser son contenu. */
function extractErrorMessage(error: Error): string {
  if (error instanceof HttpErrorResponse && isUrgentRequestErrorResponse(error.error)) {
    return error.error.message;
  }
  return GENERIC_ERROR_MESSAGE;
}

/**
 * Écran de demande d'urgence (T14, Épic 2) : dépôt d'un message privé de détresse, lu
 * uniquement par l'équipe de modération — jamais par un recruteur (voir CLAUDE.md, option
 * "urgence" du parcours étudiant) — et consultation de l'état de la dernière demande déposée.
 * Consomme exclusivement la couche data livrée en T11 (`urgent-request.queries.ts`) — aucun
 * `HttpClient`/`fetch` direct ici.
 *
 * Le 404 `URGENT_REQUEST_NOT_FOUND` de `GET /students/me/urgent-request` est un cas métier
 * NORMAL ("aucune demande en cours"), PAS une erreur applicative (voir le commentaire
 * d'`injectUrgentRequestQuery`) : ce composant le distingue explicitement de toute vraie erreur
 * (réseau, 5xx…) avant de décider quoi afficher.
 */
@Component({
  selector: 'app-urgent-request-page',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
  ],
  templateUrl: './urgent-request-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UrgentRequestPage {
  private readonly formBuilder = inject(NonNullableFormBuilder);

  /** Query TanStack `GET /students/me/urgent-request` (T11) — expose `data`, `isPending`, `error`. */
  protected readonly urgentRequestQuery = injectUrgentRequestQuery();
  /** Mutation TanStack `POST /students/me/urgent-request` (T11) — expose `mutate`, `isPending`, `error`. */
  protected readonly createMutation = injectCreateUrgentRequestMutation();

  /** `true` juste après un dépôt réussi — affiche la confirmation, jusqu'au prochain envoi. */
  protected readonly submitSucceeded = signal(false);

  /** Message de la demande — contrainte backend `UrgentRequestCreateRequest.message` : 10 à 1000 caractères. */
  protected readonly messageForm = this.formBuilder.group({
    message: this.formBuilder.control('', [
      Validators.required,
      Validators.minLength(10),
      Validators.maxLength(1000),
    ]),
  });

  /** Valeur courante du champ message, en signal — pilote le compteur de caractères. */
  private readonly messageValue = toSignal(this.messageForm.controls.message.valueChanges, {
    initialValue: this.messageForm.controls.message.value,
  });

  /** Nombre de caractères actuellement saisis, affiché à côté de la limite de 1000. */
  protected readonly characterCount = computed<number>(() => this.messageValue().length);

  /**
   * `true` si l'erreur de la query est le 404 métier `URGENT_REQUEST_NOT_FOUND` — cas normal
   * "aucune demande en cours", PAS une vraie erreur à afficher (voir le commentaire de classe).
   */
  private readonly isNotFoundError = computed<boolean>(() => {
    const error = this.urgentRequestQuery.error();
    return error instanceof HttpErrorResponse && error.status === 404;
  });

  /** Dernière demande d'urgence de l'étudiant, `null` si aucune (404) ou tant que non chargée. */
  protected readonly latestRequest = computed<UrgentRequest | null>(() => {
    if (this.isNotFoundError()) {
      return null;
    }
    return this.urgentRequestQuery.data() ?? null;
  });

  /** Message d'erreur traduit du chargement, `null` si aucune erreur ou si 404 "aucune demande". */
  protected readonly queryErrorMessage = computed<string | null>(() => {
    const error = this.urgentRequestQuery.error();
    if (error === null || this.isNotFoundError()) {
      return null;
    }
    return extractErrorMessage(error);
  });

  /**
   * `true` si le formulaire de dépôt doit être affiché : aucune demande en cours, ou dernière
   * demande déjà traitée (`prioritized`/`dismissed`). Masqué UNIQUEMENT quand une demande
   * `pending` existe déjà — une seule à la fois (contrat backend, 409
   * `URGENT_REQUEST_ALREADY_PENDING` sinon).
   */
  protected readonly showForm = computed<boolean>(() => {
    const request = this.latestRequest();
    return request === null || request.status !== 'pending';
  });

  /** Message d'erreur traduit de la dernière tentative de dépôt, `null` si aucune ou en succès. */
  protected readonly submitErrorMessage = computed<string | null>(() => {
    const error = this.createMutation.error();
    return error === null ? null : extractErrorMessage(error);
  });

  protected onSubmit(): void {
    if (this.messageForm.invalid) {
      this.messageForm.markAllAsTouched();
      return;
    }

    this.submitSucceeded.set(false);
    const { message } = this.messageForm.getRawValue();
    this.createMutation.mutate(
      { message },
      {
        onSuccess: () => {
          this.submitSucceeded.set(true);
          this.messageForm.reset({ message: '' });
        },
      },
    );
  }

  protected statusLabel(status: UrgentRequestStatus): string {
    return STATUS_LABELS[status];
  }

  protected statusBadgeClasses(status: UrgentRequestStatus): string {
    return STATUS_BADGE_CLASSES[status];
  }

  /**
   * Formate `createdAt` (ISO 8601) en date fr lisible, toujours en UTC — même règle que
   * `verification-documents.ts`/`detail.ts` : la date reste identique quel que soit le fuseau
   * horaire du lecteur.
   */
  protected formatDate(isoDate: string): string {
    return new Date(isoDate).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }
}
