import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';

import { injectLoginMutation } from '../../../core/auth/auth.queries';
import { LoginRequest } from '../../../core/auth/auth.types';
import { Role } from '../../../core/auth/role';
import { SessionService } from '../../../core/auth/session.service';
import { extractErrorMessage } from '../../../core/http/api-error';

/**
 * Redirection post-connexion par rôle (contrat `studentapi`, `components.schemas.Role` —
 * voir `core/auth/role.ts`). Les 3 espaces existent déjà dans `app.routes.ts` (Épic 0) :
 * `/etudiant`, `/recruteur`, `/moderation`. Toujours dérivée de `authResponse.user.role`
 * (jamais d'un rôle choisi côté front).
 */
const ROLE_HOME: Record<Role, string> = {
  etudiant: '/etudiant',
  recruteur: '/recruteur',
  moderateur: '/moderation',
};

/**
 * Écran de connexion, commun aux 3 rôles (étudiant / recruteur / modérateur) —
 * `POST /auth/login`. Soumission via `injectLoginMutation` (FE2, TanStack Query) — aucun
 * `HttpClient`/`fetch` direct ici. Succès -> `SessionService.setSession(authResponse)` puis
 * redirection vers l'espace correspondant au rôle renvoyé par l'API.
 */
@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly sessionService = inject(SessionService);
  private readonly router = inject(Router);

  /** Mutation TanStack `POST /auth/login` (FE2) — expose `mutate`, `isPending`, `error`. */
  protected readonly loginMutation = injectLoginMutation();

  /** Formulaire réactif conforme à `LoginRequest` (`email` + `password`, tous deux requis). */
  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  /** Message d'erreur traduit à afficher, `null` tant qu'aucune tentative n'a échoué. */
  protected readonly errorMessage = computed<string | null>(() => {
    const error = this.loginMutation.error();
    return error === null ? null : extractErrorMessage(error);
  });

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.getRawValue();
    const payload: LoginRequest = { email, password };

    this.loginMutation.mutate(payload, {
      onSuccess: (authResponse) => {
        this.sessionService.setSession(authResponse);
        void this.router.navigate([ROLE_HOME[authResponse.user.role]]);
      },
    });
  }
}
