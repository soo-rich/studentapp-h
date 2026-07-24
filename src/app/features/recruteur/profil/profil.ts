import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

import { extractErrorCode, extractErrorMessage } from '../../../core/http/api-error';
import {
  injectRecruiterProfileQuery,
  injectUpsertRecruiterProfileMutation,
} from '../data/recruiter-profile.queries';
import {
  RecruiterProfile,
  RecruiterProfileErrorCode,
  RecruiterProfileUpsertRequest,
  RecruiterStructureType,
} from '../data/recruiter-profile.types';

/** Option affichée dans le select `structureType`. */
interface StructureTypeOption {
  readonly value: RecruiterStructureType;
  readonly label: string;
}

/** Libellés fr lisibles pour chaque `RecruiterStructureType` du contrat (`recruiter-profile.types.ts`). */
const STRUCTURE_TYPE_OPTIONS: readonly StructureTypeOption[] = [
  { value: 'entreprise', label: 'Entreprise' },
  { value: 'commerce', label: 'Commerce' },
  { value: 'agence', label: 'Agence' },
  { value: 'hotel', label: 'Hôtel' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'ong', label: 'ONG' },
  { value: 'particulier', label: 'Particulier' },
];

/**
 * Écran de création/édition du profil de structure recruteur (Épic 3) : pré-remplissage
 * depuis `GET /recruiters/me/profile` (le 404 `RECRUITER_PROFILE_NOT_FOUND` est le cas
 * NOMINAL « profil pas encore créé », pas une erreur affichée — même traitement que
 * `student-profile-form.ts` pour `PROFILE_NOT_FOUND`). Formulaire volontairement plus simple
 * que celui de l'étudiant : champs plats, pas de listes dynamiques ni de champs sensibles.
 * Consomme exclusivement la couche data livrée en amont (`recruiter-profile.queries.ts`) —
 * aucun `HttpClient`/`fetch` direct ici.
 */
@Component({
  selector: 'app-recruteur-profil',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './profil.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecruteurProfil {
  private readonly formBuilder = inject(NonNullableFormBuilder);

  /** Query TanStack `GET /recruiters/me/profile` — expose `data`, `error`, `isPending`. */
  protected readonly profileQuery = injectRecruiterProfileQuery();
  /** Mutation TanStack `PUT /recruiters/me/profile` — expose `mutate`, `isPending`, `error`, `isSuccess`. */
  protected readonly upsertMutation = injectUpsertRecruiterProfileMutation();

  protected readonly structureTypeOptions = STRUCTURE_TYPE_OPTIONS;

  /** `true` dès la première tentative d'envoi — déclenche l'affichage des erreurs de validation. */
  protected readonly submitAttempted = signal(false);

  /** `true` une fois le profil chargé appliqué au formulaire (évite de re-patcher à chaque refresh). */
  private formAlreadyPatched = false;

  protected readonly form = this.formBuilder.group({
    structureName: this.formBuilder.control('', [Validators.required, Validators.maxLength(200)]),
    structureType: this.formBuilder.control<RecruiterStructureType | ''>('', Validators.required),
    contactFirstName: this.formBuilder.control('', [
      Validators.required,
      Validators.maxLength(100),
    ]),
    contactLastName: this.formBuilder.control('', [
      Validators.required,
      Validators.maxLength(100),
    ]),
    phoneNumber: this.formBuilder.control('', [Validators.required, Validators.maxLength(30)]),
    location: this.formBuilder.control('', [Validators.required, Validators.maxLength(200)]),
    description: this.formBuilder.control('', Validators.maxLength(2000)),
  });

  /**
   * `true` si l'erreur du chargement du profil est le 404 `RECRUITER_PROFILE_NOT_FOUND` — cas
   * NOMINAL (profil pas encore créé), jamais affiché comme une erreur.
   */
  private isProfileNotFoundError(error: Error): boolean {
    return extractErrorCode<RecruiterProfileErrorCode>(error) === 'RECRUITER_PROFILE_NOT_FOUND';
  }

  /** Message d'erreur du chargement du profil, `null` en succès OU sur le 404 nominal. */
  protected readonly profileLoadErrorMessage = computed<string | null>(() => {
    const error = this.profileQuery.error();
    if (error === null || this.isProfileNotFoundError(error)) {
      return null;
    }
    return extractErrorMessage(error);
  });

  /** Message d'erreur de la dernière tentative d'enregistrement, `null` si aucune ou en succès. */
  protected readonly submitErrorMessage = computed<string | null>(() => {
    const error = this.upsertMutation.error();
    return error === null ? null : extractErrorMessage(error);
  });

  constructor() {
    // Pré-remplissage depuis le profil existant, une seule fois dès qu'il est disponible.
    effect(() => {
      const profile = this.profileQuery.data();
      if (profile === undefined || this.formAlreadyPatched) {
        return;
      }
      this.formAlreadyPatched = true;
      this.patchFormFromProfile(profile);
    });
  }

  private patchFormFromProfile(profile: RecruiterProfile): void {
    this.form.patchValue({
      structureName: profile.structureName,
      structureType: profile.structureType,
      contactFirstName: profile.contactFirstName,
      contactLastName: profile.contactLastName,
      phoneNumber: profile.phoneNumber,
      location: profile.location,
      description: profile.description ?? '',
    });
  }

  /** Construit le payload `RecruiterProfileUpsertRequest`. */
  private buildPayload(): RecruiterProfileUpsertRequest {
    const raw = this.form.getRawValue();
    const trimmedDescription = raw.description.trim();

    return {
      structureName: raw.structureName.trim(),
      // `structureType` est validé requis avant l'appel de `buildPayload()` (voir `onSubmit()`) :
      // au moment où ce payload est construit, la valeur ne peut plus être `''`.
      structureType: raw.structureType as RecruiterStructureType,
      contactFirstName: raw.contactFirstName.trim(),
      contactLastName: raw.contactLastName.trim(),
      phoneNumber: raw.phoneNumber.trim(),
      location: raw.location.trim(),
      description: trimmedDescription === '' ? null : trimmedDescription,
    };
  }

  protected onSubmit(): void {
    this.submitAttempted.set(true);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.upsertMutation.mutate(this.buildPayload());
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
