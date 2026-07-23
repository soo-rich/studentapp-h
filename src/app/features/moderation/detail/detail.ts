import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
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

import { Role } from '../../../core/auth/role';
import { VerificationBadge } from '../../../shared/verification-badge/verification-badge';
import { ModerationApiService } from '../data/moderation-api.service';
import {
  injectApproveVerificationMutation,
  injectRejectVerificationMutation,
  injectVerificationDetailQuery,
} from '../data/moderation.queries';
import { VerificationDocument } from '../data/moderation.types';

/** Libellés fr lisibles pour chaque rôle (`components.schemas.Role` du contrat). */
const ROLE_LABELS: Record<Role, string> = {
  etudiant: 'Étudiant',
  recruteur: 'Recruteur',
  moderateur: 'Modérateur',
};

const BYTES_PER_KO = 1024;
const BYTES_PER_MO = 1024 * 1024;

/** Formate une taille en octets en Ko/Mo lisible (fr) — même règle que `verification-documents.ts`. */
function formatFileSize(bytes: number): string {
  if (bytes < BYTES_PER_MO) {
    return `${Math.round(bytes / BYTES_PER_KO)} Ko`;
  }
  return `${(bytes / BYTES_PER_MO).toFixed(1)} Mo`;
}

/**
 * Corps attendu dans `HttpErrorResponse.error` sur un échec de `/moderation/*` (contrat
 * `studentapi`, `components.schemas.ErrorResponse`). Redéfini localement, en LECTURE SEULE
 * pour ce composant — même pattern que `register-recruteur.ts`/`login.ts` : jamais parsé,
 * uniquement affiché tel quel (déjà traduit fr/en par le backend).
 */
interface ApiErrorBody {
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

/**
 * Détail d'une demande de vérification (back-office modération, T4/Épic 1) : identité de
 * l'utilisateur, documents avec téléchargement, et actions approuver/rejeter
 * (`POST /moderation/verifications/{userId}/approve|reject`). Consomme exclusivement la
 * couche data livrée en amont (`moderation.queries.ts`) — SEULE exception documentée :
 * `ModerationApiService.downloadDocument` est appelé directement (flux binaire ponctuel,
 * pas un état à mettre en cache, voir `moderation.queries.ts`).
 *
 * Route `/moderation/:userId` (voir `app.routes.ts` — câblage T5). Le router n'a pas
 * `withComponentInputBinding()` : `:userId` est lu via `ActivatedRoute` converti en signal.
 */
@Component({
  selector: 'app-moderation-detail',
  imports: [
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
    VerificationBadge,
  ],
  templateUrl: './detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModerationDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly moderationApi = inject(ModerationApiService);

  /** `:userId` de la route courante, `null` tant que non résolu (ne devrait pas arriver). */
  protected readonly userId = toSignal(
    this.route.paramMap.pipe(map((paramMap) => paramMap.get('userId'))),
    { initialValue: null },
  );

  /** Query TanStack `GET /moderation/verifications/{userId}` (couche data amont). */
  protected readonly detailQuery = injectVerificationDetailQuery(this.userId);
  /** Mutation TanStack `POST /moderation/verifications/{userId}/approve` (couche data amont). */
  protected readonly approveMutation = injectApproveVerificationMutation();
  /** Mutation TanStack `POST /moderation/verifications/{userId}/reject` (couche data amont). */
  protected readonly rejectMutation = injectRejectVerificationMutation();

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
   * `true` si la demande peut encore être approuvée/rejetée — uniquement lorsque le statut
   * de l'utilisateur est `pending` (déjà traité sinon, voir brief T4).
   */
  protected readonly isActionable = computed<boolean>(() => {
    const request = this.detailQuery.data();
    return request !== undefined && request.user.verificationStatus === 'pending';
  });

  /** `true` dès que le champ motif de rejet doit être affiché. */
  protected readonly showRejectForm = signal(false);

  /** Motif de rejet — contrainte backend `VerificationRejectRequest.reason` : 3 à 500 caractères. */
  protected readonly rejectForm = this.formBuilder.group({
    reason: this.formBuilder.control('', [
      Validators.required,
      Validators.minLength(3),
      Validators.maxLength(500),
    ]),
  });

  /** Identifiant du document en cours de téléchargement, `null` si aucun. */
  protected readonly downloadingDocumentId = signal<string | null>(null);
  /** Message d'erreur traduit du dernier téléchargement, `null` si aucune ou en succès. */
  protected readonly downloadErrorMessage = signal<string | null>(null);

  protected onApprove(): void {
    const userId = this.userId();
    if (userId === null) {
      return;
    }

    this.approveMutation.mutate(userId, {
      onSuccess: () => void this.router.navigate(['/moderation']),
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

    const userId = this.userId();
    if (userId === null) {
      return;
    }

    const { reason } = this.rejectForm.getRawValue();
    this.rejectMutation.mutate(
      { userId, reason },
      { onSuccess: () => void this.router.navigate(['/moderation']) },
    );
  }

  protected onDownload(document: VerificationDocument): void {
    this.downloadErrorMessage.set(null);
    this.downloadingDocumentId.set(document.id);

    this.moderationApi.downloadDocument(document.id).subscribe({
      next: (blob) => {
        this.triggerBrowserDownload(blob, document.originalFilename);
        this.downloadingDocumentId.set(null);
      },
      error: (error: Error) => {
        this.downloadErrorMessage.set(extractErrorMessage(error));
        this.downloadingDocumentId.set(null);
      },
    });
  }

  protected isDownloading(documentId: string): boolean {
    return this.downloadingDocumentId() === documentId;
  }

  protected onBack(): void {
    void this.router.navigate(['/moderation']);
  }

  protected formatFileSize(bytes: number): string {
    return formatFileSize(bytes);
  }

  protected roleLabel(role: Role): string {
    return ROLE_LABELS[role];
  }

  /**
   * Déclenche un téléchargement navigateur à partir d'un `Blob` : crée un `objectURL`,
   * l'attache à un `<a download>` éphémère, puis le révoque immédiatement après le clic
   * pour libérer la mémoire (voir brief T4).
   */
  private triggerBrowserDownload(blob: Blob, filename: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }
}
