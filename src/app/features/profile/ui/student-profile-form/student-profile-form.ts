import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

import {
  injectStudentProfileQuery,
  injectUpsertStudentProfileMutation,
} from '../../data/profile.queries';
import {
  AvailabilitySlot,
  DayOfWeek,
  HousingSituation,
  OpportunityType,
  ProfileErrorCode,
  StudentProfile,
  StudentProfileUpsertRequest,
} from '../../data/profile.types';

/** Option affichée pour un type d'opportunité (checkbox de `opportunityTypes`). */
interface OpportunityTypeOption {
  readonly value: OpportunityType;
  readonly label: string;
}

/** Libellés fr lisibles pour chaque `OpportunityType` du contrat (`profile.types.ts`). */
const OPPORTUNITY_TYPE_OPTIONS: readonly OpportunityTypeOption[] = [
  { value: 'temps_partiel', label: 'Temps partiel' },
  { value: 'mission_ponctuelle', label: 'Mission ponctuelle' },
  { value: 'job_vacances', label: 'Job de vacances' },
  { value: 'stage', label: 'Stage' },
];

/** Option affichée pour un jour de la semaine (select `dayOfWeek` d'un créneau). */
interface DayOfWeekOption {
  readonly value: DayOfWeek;
  readonly label: string;
}

const DAY_OF_WEEK_OPTIONS: readonly DayOfWeekOption[] = [
  { value: 'lundi', label: 'Lundi' },
  { value: 'mardi', label: 'Mardi' },
  { value: 'mercredi', label: 'Mercredi' },
  { value: 'jeudi', label: 'Jeudi' },
  { value: 'vendredi', label: 'Vendredi' },
  { value: 'samedi', label: 'Samedi' },
  { value: 'dimanche', label: 'Dimanche' },
];

/** Option affichée pour le select `housingSituation`. `''` = « non précisé » (pas envoyé). */
interface HousingSituationOption {
  readonly value: HousingSituation | '';
  readonly label: string;
}

const HOUSING_SITUATION_OPTIONS: readonly HousingSituationOption[] = [
  { value: '', label: 'Non précisé' },
  { value: 'seul', label: 'Vit seul(e)' },
  { value: 'avec_parents_tuteurs', label: 'Vit avec parents ou tuteurs' },
];

/** Groupe de contrôles d'un créneau de disponibilité (élément de la `FormArray` `availabilitySlots`). */
interface AvailabilitySlotControls {
  dayOfWeek: FormControl<DayOfWeek>;
  startTime: FormControl<string>;
  endTime: FormControl<string>;
}

/**
 * Validateur de `FormArray` `opportunityTypes` (checkboxes) : au moins une case cochée,
 * cohérent avec la contrainte contrat `opportunityTypes` (≥ 1 valeur).
 */
function atLeastOneCheckedValidator(control: AbstractControl): ValidationErrors | null {
  if (!(control instanceof FormArray)) {
    return null;
  }
  const hasAtLeastOneChecked = control.controls.some((checkbox) => checkbox.value === true);
  return hasAtLeastOneChecked ? null : { atLeastOneRequired: true };
}

/**
 * Validateur de groupe pour un créneau de disponibilité : `startTime` doit précéder
 * `endTime`. Comparaison lexicographique sûre car les deux valeurs sont au format `HH:mm`
 * zero-paddé (natif de `<input type="time">`), cohérent avec l'ordre chronologique.
 */
function startBeforeEndValidator(group: AbstractControl): ValidationErrors | null {
  if (!(group instanceof FormGroup)) {
    return null;
  }
  const startTime = group.get('startTime')?.value as string | undefined;
  const endTime = group.get('endTime')?.value as string | undefined;
  if (startTime === undefined || endTime === undefined || startTime === '' || endTime === '') {
    return null;
  }
  return startTime < endTime ? null : { startNotBeforeEnd: true };
}

/**
 * Corps attendu dans `HttpErrorResponse.error` sur un échec de `/students/me/profile`
 * (contrat `studentapi`, `components.schemas.ErrorResponse`). Redéfini localement, en LECTURE
 * SEULE pour ce composant — même pattern que `verification-documents.ts`/`detail.ts` : le
 * code machine `error` est utilisé pour du `switch` (narrowing sûr), `message` uniquement
 * affiché tel quel, jamais parsé pour de la logique (voir doc `ProfileErrorCode`).
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
function extractProfileErrorCode(error: Error): ProfileErrorCode | null {
  if (
    error instanceof HttpErrorResponse &&
    isApiErrorBody(error.error) &&
    typeof error.error.error === 'string'
  ) {
    return error.error.error as ProfileErrorCode;
  }
  return null;
}

/**
 * Écran de création/édition du profil détaillé étudiant (T13, Épic 2) : pré-remplissage
 * depuis `GET /students/me/profile` (le 404 `PROFILE_NOT_FOUND` est le cas nominal « profil
 * pas encore créé », pas une erreur affichée), listes dynamiques (compétences, langues,
 * créneaux de disponibilité), sélection multiple du type d'opportunité, et section de
 * données sensibles (situation de logement, handicap, allergies) masquée tant que le
 * consentement explicite n'est pas donné — décoché après saisie, les valeurs sensibles sont
 * effacées côté formulaire avant tout envoi. Consomme exclusivement la couche data livrée en
 * T10 (`profile.queries.ts`) — aucun `HttpClient`/`fetch` direct ici.
 *
 * Note UI : cases à cocher (consentement, handicap, types d'opportunité) et selects
 * (situation de logement, jour de la semaine par créneau) utilisent `MatCheckbox`/`MatSelect`,
 * cohérent avec `verification-documents.html` (seul précédent de champ de sélection du
 * projet) — y compris à l'intérieur d'un `FormArray` répétable, cas des types d'opportunité
 * et des créneaux, via `formControlName`/`formGroupName` : pattern standard supporté
 * nativement par ces composants. Les `FormArray` compétences et langues, eux, ne contiennent
 * que des champs texte.
 *
 * Les horaires de créneau restent en `<input type="time">` natif. Ce n'est PAS faute
 * d'équivalent Material : `MatTimepicker` existe depuis Material 21. Il travaille avec un
 * `DateAdapter` (valeurs `Date`), là où le contrat v0.3.0 attend des chaînes `HH:mm` — le
 * natif évite une conversion aller-retour Date↔string pour un gain d'UI nul ici.
 */
@Component({
  selector: 'app-student-profile-form',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './student-profile-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentProfileForm {
  private readonly formBuilder = inject(NonNullableFormBuilder);

  /** Query TanStack `GET /students/me/profile` (T10) — expose `data`, `error`, `isPending`. */
  protected readonly profileQuery = injectStudentProfileQuery();
  /** Mutation TanStack `PUT /students/me/profile` (T10) — expose `mutate`, `isPending`, `error`, `isSuccess`. */
  protected readonly upsertMutation = injectUpsertStudentProfileMutation();

  protected readonly opportunityTypeOptions = OPPORTUNITY_TYPE_OPTIONS;
  protected readonly dayOfWeekOptions = DAY_OF_WEEK_OPTIONS;
  protected readonly housingSituationOptions = HOUSING_SITUATION_OPTIONS;

  /** `true` dès la première tentative d'envoi — déclenche l'affichage des erreurs de validation. */
  protected readonly submitAttempted = signal(false);

  /** `true` une fois le profil chargé appliqué au formulaire (évite de re-patcher à chaque refresh). */
  private formAlreadyPatched = false;

  protected readonly form = this.formBuilder.group({
    firstName: this.formBuilder.control('', [Validators.required, Validators.maxLength(100)]),
    lastName: this.formBuilder.control('', [Validators.required, Validators.maxLength(100)]),
    phoneNumber: this.formBuilder.control('', Validators.maxLength(30)),
    university: this.formBuilder.control('', [Validators.required, Validators.maxLength(200)]),
    studentCardNumber: this.formBuilder.control('', [
      Validators.required,
      Validators.maxLength(100),
    ]),
    fieldOfStudy: this.formBuilder.control('', [Validators.required, Validators.maxLength(200)]),
    studyLevel: this.formBuilder.control('', [Validators.required, Validators.maxLength(100)]),
    residenceLocation: this.formBuilder.control('', [
      Validators.required,
      Validators.maxLength(200),
    ]),
    experiences: this.formBuilder.control('', Validators.maxLength(2000)),
    skills: this.formBuilder.array<FormControl<string>>([]),
    languages: this.formBuilder.array<FormControl<string>>([]),
    opportunityTypes: this.formBuilder.array(
      OPPORTUNITY_TYPE_OPTIONS.map(() => this.formBuilder.control(false)),
      atLeastOneCheckedValidator,
    ),
    availabilitySlots: this.formBuilder.array<FormGroup<AvailabilitySlotControls>>([]),
    sensitiveDataConsent: this.formBuilder.control(false),
    housingSituation: this.formBuilder.control<HousingSituation | ''>(''),
    hasDisability: this.formBuilder.control(false),
    disabilityDescription: this.formBuilder.control('', Validators.maxLength(500)),
    allergies: this.formBuilder.control('', Validators.maxLength(500)),
  });

  /**
   * `true` si l'erreur du chargement du profil est le 404 `PROFILE_NOT_FOUND` — cas NOMINAL
   * (profil pas encore créé), jamais affiché comme une erreur.
   */
  private isProfileNotFoundError(error: Error): boolean {
    return extractProfileErrorCode(error) === 'PROFILE_NOT_FOUND';
  }

  /** Message d'erreur du chargement du profil, `null` en succès OU sur le 404 nominal. */
  protected readonly profileLoadErrorMessage = computed<string | null>(() => {
    const error = this.profileQuery.error();
    if (error === null || this.isProfileNotFoundError(error)) {
      return null;
    }
    return extractErrorMessage(error);
  });

  /**
   * Message d'erreur de la dernière tentative d'enregistrement, `null` si aucune ou en
   * succès. Cas spécial `PROFILE_SENSITIVE_CONSENT_REQUIRED` (422) : message dédié,
   * compréhensible, plutôt que le message brut du backend.
   */
  protected readonly submitErrorMessage = computed<string | null>(() => {
    const error = this.upsertMutation.error();
    if (error === null) {
      return null;
    }
    if (extractProfileErrorCode(error) === 'PROFILE_SENSITIVE_CONSENT_REQUIRED') {
      return 'Coche la case de consentement pour pouvoir enregistrer les informations sensibles.';
    }
    return extractErrorMessage(error);
  });

  constructor() {
    // Décoche du consentement -> effacement immédiat des 4 champs sensibles côté formulaire
    // (pas seulement au submit), pour qu'aucune valeur sensible ne reste visible ni ne
    // finisse dans le payload envoyé (voir aussi la double sécurité dans `buildPayload()`).
    this.form.controls.sensitiveDataConsent.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((hasConsent) => {
        if (!hasConsent) {
          this.clearSensitiveFields();
        }
      });

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

  private createSkillControl(value = ''): FormControl<string> {
    return this.formBuilder.control(value, Validators.required);
  }

  private createLanguageControl(value = ''): FormControl<string> {
    return this.formBuilder.control(value, Validators.required);
  }

  private createAvailabilitySlotGroup(slot?: AvailabilitySlot): FormGroup<AvailabilitySlotControls> {
    return this.formBuilder.group(
      {
        dayOfWeek: this.formBuilder.control<DayOfWeek>(slot?.dayOfWeek ?? 'lundi', Validators.required),
        startTime: this.formBuilder.control(slot?.startTime ?? '', Validators.required),
        endTime: this.formBuilder.control(slot?.endTime ?? '', Validators.required),
      },
      { validators: startBeforeEndValidator },
    );
  }

  private clearSensitiveFields(): void {
    this.form.patchValue({
      housingSituation: '',
      hasDisability: false,
      disabilityDescription: '',
      allergies: '',
    });
  }

  private patchFormFromProfile(profile: StudentProfile): void {
    this.form.patchValue({
      firstName: profile.firstName,
      lastName: profile.lastName,
      phoneNumber: profile.phoneNumber ?? '',
      university: profile.university,
      studentCardNumber: profile.studentCardNumber,
      fieldOfStudy: profile.fieldOfStudy,
      studyLevel: profile.studyLevel,
      residenceLocation: profile.residenceLocation,
      experiences: profile.experiences ?? '',
      sensitiveDataConsent: profile.sensitiveDataConsent,
      housingSituation: profile.housingSituation ?? '',
      hasDisability: profile.hasDisability ?? false,
      disabilityDescription: profile.disabilityDescription ?? '',
      allergies: profile.allergies ?? '',
    });

    const opportunityTypeControls = this.form.controls.opportunityTypes.controls;
    OPPORTUNITY_TYPE_OPTIONS.forEach((option, index) => {
      opportunityTypeControls[index]?.setValue(profile.opportunityTypes.includes(option.value));
    });

    const skillsArray = this.form.controls.skills;
    skillsArray.clear();
    profile.skills.forEach((skill) => skillsArray.push(this.createSkillControl(skill)));

    const languagesArray = this.form.controls.languages;
    languagesArray.clear();
    profile.languages.forEach((language) => languagesArray.push(this.createLanguageControl(language)));

    const availabilitySlotsArray = this.form.controls.availabilitySlots;
    availabilitySlotsArray.clear();
    profile.availabilitySlots.forEach((slot) =>
      availabilitySlotsArray.push(this.createAvailabilitySlotGroup(slot)),
    );
  }

  /** Construit le payload `StudentProfileUpsertRequest` — aucun champ sensible si le consentement n'est pas donné. */
  private buildPayload(): StudentProfileUpsertRequest {
    const raw = this.form.getRawValue();

    const opportunityTypes = OPPORTUNITY_TYPE_OPTIONS.filter(
      (_option, index) => raw.opportunityTypes[index] === true,
    ).map((option) => option.value);

    const skills = raw.skills.map((skill) => skill.trim()).filter((skill) => skill.length > 0);
    const languages = raw.languages
      .map((language) => language.trim())
      .filter((language) => language.length > 0);

    const availabilitySlots: AvailabilitySlot[] = raw.availabilitySlots.map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
    }));

    const consentGiven = raw.sensitiveDataConsent;
    const trimmedPhoneNumber = raw.phoneNumber.trim();
    const trimmedExperiences = raw.experiences.trim();
    const trimmedDisabilityDescription = raw.disabilityDescription.trim();
    const trimmedAllergies = raw.allergies.trim();

    return {
      firstName: raw.firstName.trim(),
      lastName: raw.lastName.trim(),
      phoneNumber: trimmedPhoneNumber === '' ? null : trimmedPhoneNumber,
      university: raw.university.trim(),
      studentCardNumber: raw.studentCardNumber.trim(),
      fieldOfStudy: raw.fieldOfStudy.trim(),
      studyLevel: raw.studyLevel.trim(),
      skills,
      experiences: trimmedExperiences === '' ? null : trimmedExperiences,
      languages,
      residenceLocation: raw.residenceLocation.trim(),
      opportunityTypes,
      availabilitySlots,
      // Double sécurité : même si `clearSensitiveFields()` a déjà vidé les contrôles au
      // moment de la décoche, le payload envoyé n'inclut JAMAIS de valeur sensible tant que
      // `consentGiven` est faux, quelle que soit la valeur brute restée dans le formulaire.
      sensitiveDataConsent: consentGiven,
      housingSituation: consentGiven && raw.housingSituation !== '' ? raw.housingSituation : null,
      hasDisability: consentGiven ? raw.hasDisability : null,
      disabilityDescription:
        consentGiven && raw.hasDisability && trimmedDisabilityDescription !== ''
          ? trimmedDisabilityDescription
          : null,
      allergies: consentGiven && trimmedAllergies !== '' ? trimmedAllergies : null,
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

  protected onAddSkill(): void {
    this.form.controls.skills.push(this.createSkillControl());
  }

  protected onRemoveSkill(index: number): void {
    this.form.controls.skills.removeAt(index);
  }

  protected onAddLanguage(): void {
    this.form.controls.languages.push(this.createLanguageControl());
  }

  protected onRemoveLanguage(index: number): void {
    this.form.controls.languages.removeAt(index);
  }

  protected onAddAvailabilitySlot(): void {
    this.form.controls.availabilitySlots.push(this.createAvailabilitySlotGroup());
  }

  protected onRemoveAvailabilitySlot(index: number): void {
    this.form.controls.availabilitySlots.removeAt(index);
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
