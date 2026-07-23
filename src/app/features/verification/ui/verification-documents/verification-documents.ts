import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule, MatSelectChange } from '@angular/material/select';

import { Role } from '../../../../core/auth/role';
import { SessionService } from '../../../../core/auth/session.service';
import { VerificationBadge } from '../../../../shared/verification-badge/verification-badge';
import {
  injectDeleteVerificationDocumentMutation,
  injectUploadVerificationDocumentMutation,
  injectVerificationDocumentsQuery,
} from '../../data/verification.queries';
import { DocumentType } from '../../data/verification.types';

/** Option affichée dans le sélecteur de type de document, filtrée par rôle. */
interface DocumentTypeOption {
  readonly value: DocumentType;
  readonly label: string;
}

/** Libellés fr lisibles pour chaque `DocumentType` du contrat (`verification.types.ts`). */
const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  carte_etudiant: "Carte d'étudiant",
  certificat_scolarite: 'Certificat de scolarité',
  piece_identite: "Pièce d'identité",
  justificatif_structure: 'Justificatif de la structure',
};

/**
 * Types de document autorisés par rôle (contrainte backend documentée dans
 * `verification.types.ts` — 422 `VERIFICATION_DOCUMENT_INVALID_TYPE` sinon). `moderateur` n'a
 * aucun document de vérification à envoyer (rôle interne) : liste vide.
 */
const DOCUMENT_TYPES_BY_ROLE: Record<Role, readonly DocumentType[]> = {
  etudiant: ['carte_etudiant', 'certificat_scolarite'],
  recruteur: ['piece_identite', 'justificatif_structure'],
  moderateur: [],
};

/** Taille maximale acceptée côté client (le backend rejette au-delà, `VERIFICATION_FILE_TOO_LARGE`). */
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const BYTES_PER_KO = 1024;
const BYTES_PER_MO = 1024 * 1024;

/** Formate une taille en octets en Ko/Mo lisible (fr). */
function formatFileSize(bytes: number): string {
  if (bytes < BYTES_PER_MO) {
    return `${Math.round(bytes / BYTES_PER_KO)} Ko`;
  }
  return `${(bytes / BYTES_PER_MO).toFixed(1)} Mo`;
}

/**
 * Corps attendu dans `HttpErrorResponse.error` sur un échec de `/verification/documents*`
 * (contrat `studentapi`, `components.schemas.ErrorResponse`). Redéfini localement, en LECTURE
 * SEULE pour ce composant — même pattern que `register-etudiant.ts`/`login.ts` : jamais parsé,
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
 * Écran d'upload des documents de vérification, PARTAGÉ étudiant + recruteur (T2, Épic 1) :
 * badge de statut, ajout d'un document (type filtré par rôle + fichier), liste des documents
 * déjà envoyés avec suppression. Consomme exclusivement la couche data livrée en FE10
 * (`verification.queries.ts`) — aucun `HttpClient`/`fetch` direct ici.
 *
 * Suppression désactivée lorsque le profil est `verified` (le backend renvoie 409
 * `VERIFICATION_ALREADY_VERIFIED` sinon, voir `verification.types.ts`).
 */
@Component({
  selector: 'app-verification-documents',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    VerificationBadge,
  ],
  templateUrl: './verification-documents.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerificationDocuments {
  private readonly sessionService = inject(SessionService);

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  /** Query TanStack `GET /verification/documents` (FE10) — expose `data`, `isPending`, `error`. */
  protected readonly documentsQuery = injectVerificationDocumentsQuery();
  /** Mutation TanStack `POST /verification/documents` (FE10) — expose `mutate`, `isPending`, `error`. */
  protected readonly uploadMutation = injectUploadVerificationDocumentMutation();
  /** Mutation TanStack `DELETE /verification/documents/{id}` (FE10) — expose `mutate`, `isPending`, `error`, `variables`. */
  protected readonly deleteMutation = injectDeleteVerificationDocumentMutation();

  /** Utilisateur courant — source du badge de statut affiché en haut de l'écran. */
  protected readonly currentUser = this.sessionService.currentUser;

  /** Options de type de document, dérivées du rôle courant (étudiant/recruteur). */
  protected readonly documentTypeOptions = computed<DocumentTypeOption[]>(() => {
    const role = this.sessionService.currentRole();
    const types = role === null ? [] : DOCUMENT_TYPES_BY_ROLE[role];
    return types.map((value) => ({ value, label: DOCUMENT_TYPE_LABELS[value] }));
  });

  /** Type de document sélectionné dans le formulaire d'ajout, `null` tant qu'aucun choix. */
  protected readonly selectedType = signal<DocumentType | null>(null);
  /** Fichier sélectionné dans le formulaire d'ajout, `null` tant qu'aucun choix. */
  protected readonly selectedFile = signal<File | null>(null);
  /** `true` dès la première tentative d'envoi — déclenche l'affichage des erreurs de validation. */
  private readonly submitAttempted = signal(false);

  /** Message de validation du type, affiché uniquement après une tentative d'envoi. */
  protected readonly typeErrorMessage = computed<string | null>(() => {
    if (!this.submitAttempted() || this.selectedType() !== null) {
      return null;
    }
    return 'Choisis un type de document.';
  });

  /**
   * Message de validation du fichier (requis + taille ≤ 5 Mo), affiché uniquement après une
   * tentative d'envoi. Validation CLIENT effectuée avant tout appel à la mutation d'upload,
   * pour éviter l'aller-retour réseau sur un fichier que le backend rejetterait de toute façon
   * (`VERIFICATION_FILE_TOO_LARGE`).
   */
  protected readonly fileErrorMessage = computed<string | null>(() => {
    if (!this.submitAttempted()) {
      return null;
    }
    const file = this.selectedFile();
    if (file === null) {
      return 'Sélectionne un fichier avant d’envoyer.';
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `Le fichier est trop volumineux (${formatFileSize(file.size)}) : 5 Mo maximum.`;
    }
    return null;
  });

  /** Message d'erreur traduit de la dernière tentative d'upload, `null` si aucune ou en succès. */
  protected readonly uploadErrorMessage = computed<string | null>(() => {
    const error = this.uploadMutation.error();
    return error === null ? null : extractErrorMessage(error);
  });

  /** Message d'erreur traduit de la dernière tentative de suppression, `null` si aucune ou en succès. */
  protected readonly deleteErrorMessage = computed<string | null>(() => {
    const error = this.deleteMutation.error();
    return error === null ? null : extractErrorMessage(error);
  });

  /** Message d'erreur traduit du chargement de la liste, `null` si aucune ou en succès. */
  protected readonly queryErrorMessage = computed<string | null>(() => {
    const error = this.documentsQuery.error();
    return error === null ? null : extractErrorMessage(error);
  });

  /**
   * `true` si le profil de l'utilisateur courant est `verified` — la suppression est alors
   * désactivée (le backend renvoie 409 `VERIFICATION_ALREADY_VERIFIED` sinon).
   */
  protected readonly isVerified = computed<boolean>(
    () => this.currentUser()?.verificationStatus === 'verified',
  );

  /** `true` si la suppression d'un document est actuellement permise. */
  protected readonly canDeleteDocuments = computed<boolean>(() => !this.isVerified());

  protected onTypeChange(change: MatSelectChange): void {
    this.selectedType.set(change.value as DocumentType);
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.[0] ?? null);
  }

  protected onSubmit(): void {
    this.submitAttempted.set(true);

    const type = this.selectedType();
    const file = this.selectedFile();
    if (type === null || file === null || file.size > MAX_FILE_SIZE_BYTES) {
      return;
    }

    this.uploadMutation.mutate(
      { type, file },
      {
        onSuccess: () => this.resetForm(),
      },
    );
  }

  protected onDelete(documentId: string): void {
    this.deleteMutation.mutate(documentId);
  }

  /** `true` si `documentId` est le document actuellement en cours de suppression. */
  protected isDeleting(documentId: string): boolean {
    return this.deleteMutation.isPending() && this.deleteMutation.variables() === documentId;
  }

  protected formatFileSize(bytes: number): string {
    return formatFileSize(bytes);
  }

  protected documentTypeLabel(type: DocumentType): string {
    return DOCUMENT_TYPE_LABELS[type];
  }

  /**
   * Formate `uploadedAt` (ISO 8601) en date fr lisible, toujours en UTC : la date d'envoi
   * doit rester identique quel que soit le fuseau horaire du lecteur (modération incluse).
   */
  protected formatDate(isoDate: string): string {
    return new Date(isoDate).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  private resetForm(): void {
    this.selectedType.set(null);
    this.selectedFile.set(null);
    this.submitAttempted.set(false);

    const inputElement = this.fileInput()?.nativeElement;
    if (inputElement) {
      inputElement.value = '';
    }
  }
}
